import json
import sys
from functools import update_wrapper
from pathlib import Path
from pprint import pprint
from random import randint
from typing import Any, Callable

import click
import requests
import structlog
from _util import validate_address
from eth_account import Account
from eth_typing import URI
from web3 import HTTPProvider, Web3
from web3.contract import Contract
from web3.middleware import construct_sign_and_send_raw_middleware, geth_poa_middleware

import raisync.contracts
from raisync.typing import Address, ChainId, PrivateKey, TokenAmount
from raisync.util import setup_logging

log = structlog.get_logger(__name__)


def connect_to_blockchain(deployment_dir: Path, eth_rpc: URI) -> tuple[Web3, dict[str, Contract]]:
    try:
        provider = HTTPProvider(eth_rpc)
        web3 = Web3(provider)
        # Do a request, will throw ConnectionError on bad Ethereum client
        chain_id = ChainId(web3.eth.chain_id)
    except requests.exceptions.ConnectionError:
        log.error(
            "Can not connect to the Ethereum client. Please check that it is running and that "
            "your settings are correct.",
            eth_rpc=eth_rpc,
        )
        sys.exit(1)

    # Add POA middleware for geth POA chains, no/op for other chains
    web3.middleware_onion.inject(geth_poa_middleware, layer=0)

    deployment_info = raisync.contracts.load_deployment_info(deployment_dir)
    contract_infos = deployment_info[chain_id]
    contracts = {
        name: web3.eth.contract(abi=info.abi, address=info.address)
        for name, info in contract_infos.items()
    }

    return web3, contracts


def open_keystore(keystore_file: str, password: str) -> PrivateKey:
    with open(keystore_file, mode="r", encoding="utf-8") as keystore:
        try:
            private_key = bytes(
                Account.decrypt(keyfile_json=json.load(keystore), password=password)
            )
            return PrivateKey(private_key)
        except ValueError as error:
            log.critical(
                "Could not decode keyfile with given password. Please try again.",
                reason=str(error),
            )
            sys.exit(1)


def pass_args(f: Callable) -> Callable:
    @click.pass_context
    def new_func(ctx: Any, *args: Any, **kwargs: Any) -> Callable:
        return ctx.invoke(f, *ctx.obj.values(), *args, **kwargs)

    return update_wrapper(new_func, f)


@click.group("cli")
@click.option(
    "--deployment-dir",
    type=Path,
    required=True,
    metavar="DIR",
    help="The directory that stores contract deployment files.",
)
@click.option(
    "--keystore-file",
    required=True,
    type=click.Path(exists=True, dir_okay=False, readable=True),
    help="Path to a keystore file.",
)
@click.password_option(
    "--password",
    confirmation_prompt=False,
    help="Password to unlock the keystore file.",
)
@click.option("--eth-rpc", default="http://localhost:8545", type=str, help="Ethereum node RPC URI")
@click.pass_context
def cli(ctx: Any, deployment_dir: Path, keystore_file: str, password: str, eth_rpc: URI) -> None:
    ctx.ensure_object(dict)

    ctx.obj["deployment_dir"] = deployment_dir
    ctx.obj["keystore_file"] = keystore_file
    ctx.obj["password"] = password
    ctx.obj["eth_rpc"] = eth_rpc


@click.option(
    "--target-chain-id",
    type=int,
    help="Id of the target chain",
)
@click.option(
    "--target-token-address",
    type=str,
    callback=validate_address,
    help="Address of the token contract on the target chain",
)
@click.option(
    "--target-address",
    type=str,
    callback=validate_address,
    help="Receiver of the tokens on the target chain",
)
@click.option(
    "--amount",
    type=int,
    help="Amount of tokens to transfer",
)
@click.option(
    "--validity-period",
    type=int,
    default=15 * 60,
    help="Amount of tokens to transfer",
)
@cli.command("request")
@pass_args
def submit_request(
    deployment_dir: Path,
    keystore_file: str,
    password: str,
    eth_rpc: URI,
    target_chain_id: ChainId,
    target_token_address: Address,
    target_address: Address,
    amount: TokenAmount,
    validity_period: int,
) -> None:
    """Register a RaiSync request"""
    setup_logging(log_level="DEBUG", log_json=False)
    web3, contracts = connect_to_blockchain(deployment_dir, eth_rpc=eth_rpc)
    privkey = open_keystore(keystore_file, password)

    account = Account.from_key(privkey)
    web3.eth.default_account = account.address

    # Add middleware to sign transactions by default
    web3.middleware_onion.add(construct_sign_and_send_raw_middleware(account))

    request_manager = contracts["RequestManager"]
    token = contracts["MintableToken"]
    tx_hash = token.functions.approve(request_manager.address, amount).transact()
    web3.eth.wait_for_transaction_receipt(tx_hash, poll_latency=1.0)
    fee = request_manager.functions.totalFee().call()

    tx_hash = request_manager.functions.createRequest(
        target_chain_id,
        token.address,
        target_token_address,
        target_address,
        amount,
        validity_period,
    ).transact({"value": fee})
    tx_receipt = web3.eth.wait_for_transaction_receipt(tx_hash, poll_latency=1.0)

    print(f"TX sent! tx_hash: {tx_hash.hex()}")
    print("Receipt:")
    pprint(tx_receipt)


@click.option(
    "--request-id",
    type=int,
    default=randint(0, 1000000),
    help="Id of the source chain",
)
@click.option(
    "--source-chain-id",
    type=int,
    help="Id of the source chain",
)
@click.option(
    "--target-address",
    type=str,
    callback=validate_address,
    help="Receiver of the tokens on the target chain",
)
@click.option(
    "--amount",
    type=int,
    help="Amount of tokens to transfer",
)
@cli.command("fill")
@pass_args
def fill_request(
    deployment_dir: Path,
    keystore_file: str,
    password: str,
    eth_rpc: URI,
    request_id: int,
    source_chain_id: ChainId,
    target_address: Address,
    amount: TokenAmount,
) -> None:
    """fill a RaiSync request"""
    setup_logging(log_level="DEBUG", log_json=False)

    web3, contracts = connect_to_blockchain(deployment_dir, eth_rpc=eth_rpc)
    privkey = open_keystore(keystore_file, password)

    account = Account.from_key(privkey)
    web3.eth.default_account = account.address

    # Add middleware to sign transactions by default
    web3.middleware_onion.add(construct_sign_and_send_raw_middleware(account))

    fill_manager = contracts["FillManager"]
    token = contracts["MintableToken"]
    tx_hash = token.functions.approve(fill_manager.address, amount).transact()
    web3.eth.wait_for_transaction_receipt(tx_hash, poll_latency=1.0)

    tx_hash = fill_manager.functions.fillRequest(
        request_id,
        source_chain_id,
        token.address,
        target_address,
        amount,
    ).transact()

    tx_receipt = web3.eth.wait_for_transaction_receipt(tx_hash, poll_latency=1.0)

    print(f"TX sent! tx_hash: {tx_hash.hex()}")
    print("Receipt:")
    pprint(tx_receipt)


if __name__ == "__main__":
    cli()
