from functools import update_wrapper
from pathlib import Path
from random import randint
from typing import Any, Callable, Optional

import click
import structlog
from eth_utils import to_canonical_address, to_checksum_address
from web3 import Web3
from web3.constants import ADDRESS_ZERO
from web3.contract import Contract

from beamer.typing import URL, Address, ChainId, TokenAmount
from beamer.util import account_from_keyfile, make_web3, setup_logging
from scripts._util import contracts_for_web3, validate_address, validate_bytes

log = structlog.get_logger(__name__)


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
def cli(ctx: Any, deployment_dir: Path, keystore_file: Path, password: str, eth_rpc: URL) -> None:
    setup_logging(log_level="DEBUG", log_json=False)

    account = account_from_keyfile(keystore_file, password)
    web3 = make_web3(eth_rpc, account)
    contracts = contracts_for_web3(web3, deployment_dir)

    ctx.ensure_object(dict)
    ctx.obj["web3"] = web3
    ctx.obj["contracts"] = contracts


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
    help="Period until the request is expired",
)
@cli.command("request")
@pass_args
def submit_request(
    web3: Web3,
    contracts: dict[str, Contract],
    target_chain_id: ChainId,
    target_token_address: Address,
    target_address: Address,
    amount: TokenAmount,
    validity_period: int,
) -> None:
    """Register a Beamer request"""

    request_manager = contracts["RequestManager"]
    token = contracts["MintableToken"]
    total = amount + request_manager.functions.totalFee(amount).call()
    tx_hash = token.functions.approve(request_manager.address, total).transact()
    web3.eth.wait_for_transaction_receipt(tx_hash, poll_latency=1.0)

    tx_hash = request_manager.functions.createRequest(
        target_chain_id,
        token.address,
        target_token_address,
        target_address,
        amount,
        validity_period,
    ).transact()
    web3.eth.wait_for_transaction_receipt(tx_hash, poll_latency=1.0)

    print(f"Transaction sent, tx_hash: {tx_hash.hex()}")


@click.option(
    "--request-id",
    type=int,
    default=randint(0, 1000000),
    help="Request id to fill",
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
    web3: Web3,
    contracts: dict[str, Contract],
    request_id: int,
    source_chain_id: ChainId,
    target_address: Address,
    amount: TokenAmount,
) -> None:
    """Fill a Beamer request"""

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
    web3.eth.wait_for_transaction_receipt(tx_hash, poll_latency=1.0)

    print(f"Transaction sent, tx_hash: {tx_hash.hex()}")


@click.option(
    "--request-id",
    type=int,
    help="Request id to claim",
)
@click.option(
    "--fill-id",
    type=str,
    callback=validate_bytes,
    default="0x00",
    help="fill id of a corresponding claim",
)
@cli.command("claim")
@pass_args
def claim_request(
    web3: Web3,
    contracts: dict[str, Contract],
    request_id: int,
    fill_id: bytes,
) -> None:
    """Claim a Beamer request"""

    request_manager = contracts["RequestManager"]
    claim_stake = request_manager.functions.claimStake().call()
    request = request_manager.functions.requests(request_id).call()
    deposit_receiver = request[6][0]
    valid_until = request[8]
    current_time = web3.eth.get_block("latest").get("timestamp")

    if current_time >= valid_until:
        print("Request already expired")
        return
    if deposit_receiver != ADDRESS_ZERO:
        print("Request already withdrawn")
        return

    tx_hash = request_manager.functions.claimRequest(request_id, fill_id).transact(
        {"value": claim_stake}
    )
    web3.eth.wait_for_transaction_receipt(tx_hash, poll_latency=1.0)

    print(f"Transaction sent, tx_hash: {tx_hash.hex()}")


@click.option(
    "--request-id",
    type=int,
    help="Request id of expired request",
)
@cli.command("withdraw-expired")
@pass_args
def withdraw_expired(
    web3: Web3,
    contracts: dict[str, Contract],
    request_id: int,
) -> None:
    """Withdraw an expired Beamer request"""

    request_manager = contracts["RequestManager"]
    request = request_manager.functions.requests(request_id).call()
    deposit_receiver = request[6]
    active_claims = request[7]
    valid_until = request[8]
    current_time = web3.eth.get_block("latest").get("timestamp")

    if current_time < valid_until:
        print("Request not expired yet. Cannot withdraw.")
        return
    if deposit_receiver != ADDRESS_ZERO:
        print("Request already withdrawn. Cannot withdraw.")
        return
    if active_claims > 0:
        print("Request has active claims. Cannot withdraw.")
        return

    tx_hash = request_manager.functions.withdrawExpiredRequest(request_id).transact()
    web3.eth.wait_for_transaction_receipt(tx_hash, poll_latency=1.0)

    print(f"Transaction sent, tx_hash: {tx_hash.hex()}")


@click.option(
    "--recipient",
    type=str,
    metavar="ADDRESS",
    callback=validate_address,
    help="Address that should receive the minted tokens.",
)
@click.option(
    "--amount",
    type=int,
    default=100 * 10**18,
    help="Amount of tokens to transfer",
)
@cli.command("mint")
@pass_args
def mint(
    web3: Web3,
    contracts: dict[str, Contract],
    recipient: Optional[Address],
    amount: TokenAmount,
) -> None:
    """Mint tokens"""

    token = contracts["MintableToken"]
    recipient = recipient or to_canonical_address(web3.eth.default_account)  # type: ignore
    tx_hash = token.functions.mint(recipient, amount).transact()
    web3.eth.wait_for_transaction_receipt(tx_hash, poll_latency=1.0)

    print(f"Transaction sent, tx_hash: {tx_hash.hex()}")


@click.argument(
    "address",
    type=str,
    required=True,
    metavar="ADDRESS",
    callback=validate_address,
)
@cli.command("whitelist")
@pass_args
def whitelist(
    web3: Web3,
    contracts: dict[str, Contract],
    address: Address,
) -> None:
    """Whitelist a LP"""

    fill_manager = contracts["FillManager"]

    if fill_manager.functions.allowedLPs(address).call():
        print(f"Address '{to_checksum_address(address)}' is already whitelisted.")
        return

    tx_hash = fill_manager.functions.addAllowedLP(address).transact()
    web3.eth.wait_for_transaction_receipt(tx_hash, poll_latency=1.0)

    print(f"Transaction sent, tx_hash: {tx_hash.hex()}")


@cli.command("update-fee")
@click.argument(
    "protocol-fee-ppm",
    type=int,
    required=True,
)
@click.argument(
    "lp-fee-ppm",
    type=int,
    required=True,
)
@click.argument(
    "min-lp-fee",
    type=int,
    required=True,
)
@pass_args
def update_fee(
    web3: Web3,
    contracts: dict[str, Contract],
    protocol_fee_ppm: int,
    lp_fee_ppm: int,
    min_lp_fee: int,
) -> None:
    """Update fee of Request Manager. Must be done by owner."""

    request_manager = contracts["RequestManager"]

    tx_hash = request_manager.functions.updateFeeData(
        protocol_fee_ppm, lp_fee_ppm, min_lp_fee
    ).transact()
    web3.eth.wait_for_transaction_receipt(tx_hash, poll_latency=1.0)

    print(f"Transaction sent, tx_hash: {tx_hash.hex()}")


if __name__ == "__main__":
    cli()
