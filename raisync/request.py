import json
import sys
from pathlib import Path
from pprint import pprint
from typing import Dict, Tuple

import click
import requests
import structlog
from eth_account import Account
from eth_typing import URI
from web3 import HTTPProvider, Web3
from web3.contract import Contract
from web3.middleware import construct_sign_and_send_raw_middleware, geth_poa_middleware

from raisync.cli import validate_address
from raisync.logging import setup_logging
from raisync.typing import Address, ChainId, PrivateKey, TokenAmount

log = structlog.get_logger(__name__)


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


def get_contract_infos() -> Dict[str, Dict]:
    contracts = {}
    base_path = Path("contracts/build/deployments/420")
    for path in base_path.glob("*.json"):
        with open(path) as f:
            contracts_infos = json.load(f)

            contract_name = contracts_infos["contractName"]
            contract_abi = contracts_infos["abi"]
            contract_deployment = contracts_infos["deployment"]

            contracts[contract_name] = {
                "abi": contract_abi,
                **contract_deployment,
            }

    return contracts


def connect_to_blockchain(
    eth_rpc: URI,
) -> Tuple[Web3, Dict[str, Dict], Dict[str, Contract]]:
    try:
        provider = HTTPProvider(eth_rpc)
        web3 = Web3(provider)
        # Do a request, will throw ConnectionError on bad Ethereum client
        _chain_id = web3.eth.chain_id  # noqa
    except requests.exceptions.ConnectionError:
        log.error(
            "Can not connect to the Ethereum client. Please check that it is running and that "
            "your settings are correct.",
            eth_rpc=eth_rpc,
        )
        sys.exit(1)

    # Add POA middleware for geth POA chains, no/op for other chains
    web3.middleware_onion.inject(geth_poa_middleware, layer=0)

    contract_infos = get_contract_infos()
    contracts = {
        name: web3.eth.contract(abi=infos["abi"], address=infos["address"])
        for name, infos in contract_infos.items()
    }

    return web3, contract_infos, contracts


@click.command()
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
@click.option(
    "--target-chain-id",
    type=str,
    callback=validate_address,
    help="Id of the target chain",
)
@click.option(
    "--source-token-address",
    type=str,
    callback=validate_address,
    help="Address of the token contract on the source chain",
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
def submit_request(
    keystore_file: str,
    password: str,
    eth_rpc: URI,
    target_chain_id: ChainId,
    source_token_address: Address,
    target_token_address: Address,
    target_address: Address,
    amount: TokenAmount,
):
    """Register a RaiSync request"""
    setup_logging(log_level="DEBUG", log_json=False)

    web3, _, contracts = connect_to_blockchain(eth_rpc=eth_rpc)
    privkey = open_keystore(keystore_file, password)

    # Add middleware to sign transactions by default
    web3.middleware_onion.add(construct_sign_and_send_raw_middleware(privkey))

    request_manager = contracts["RequestManager"]
    tx_hash = request_manager.functions.request(
        target_chain_id,
        source_token_address,
        target_token_address,
        target_address,
        amount,
    ).transact()

    tx_receipt = web3.eth.wait_for_transaction_receipt(tx_hash, poll_latency=1.0)

    print(f"TX sent! tx_hash: {tx_hash.hex()}")
    print("Receipt:")
    pprint(tx_receipt)


if __name__ == "__main__":
    submit_request()
