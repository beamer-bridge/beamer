from pathlib import Path
from typing import Any, Optional

import click
import structlog
from eth_utils import to_canonical_address
from web3 import Web3
from web3.constants import ADDRESS_ZERO
from web3.contract import Contract

import beamer.artifacts
from beamer.contracts import ABIManager, obtain_contract
from beamer.typing import URL, Address, ChainId, TokenAmount
from beamer.util import account_from_keyfile, make_web3, setup_logging, transact
from scripts._util import pass_args, validate_address, validate_bytes

log = structlog.get_logger(__name__)


@click.group("cli")
@click.option(
    "--artifacts-dir",
    type=Path,
    required=True,
    metavar="DIR",
    help="The directory that stores deployment artifact files.",
)
@click.option(
    "--abi-dir",
    type=Path,
    required=True,
    metavar="DIR",
    help="Path to the directory with contract ABIs",
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
def cli(
    ctx: Any, artifacts_dir: Path, abi_dir: Path, keystore_file: Path, password: str, eth_rpc: URL
) -> None:
    setup_logging(log_level="DEBUG", log_json=False)

    account = account_from_keyfile(keystore_file, password)
    web3 = make_web3(eth_rpc, account)

    abi_manager = ABIManager(abi_dir)
    deployment = beamer.artifacts.load(artifacts_dir, ChainId(web3.eth.chain_id))

    contracts = {}
    for name in ("RequestManager", "FillManager", "MintableToken"):
        contracts[name] = obtain_contract(web3, abi_manager, deployment, name)

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
    default=30 * 60,
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
    total = (
        amount + request_manager.functions.totalFee(target_chain_id, token.address, amount).call()
    )
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
    type=str,
    callback=validate_bytes,
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
    request_id: bytes,
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
    type=str,
    callback=validate_bytes,
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
    request_id: bytes,
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
    "--claim-id",
    type=int,
    help="Claim id to claim",
)
@cli.command("challenge")
@pass_args
def challenge_claim(
    web3: Web3,
    contracts: dict[str, Contract],
    claim_id: int,
) -> None:
    """Challenge a Beamer claim"""

    request_manager = contracts["RequestManager"]
    claim = request_manager.functions.claims(claim_id).call()
    highest_stake = max(claim[2], claim[5])
    # it seems that challengersStakes is only included in the tuple
    # if there is at least one entry in the mapping
    # indexing with -2 always returns the termination timestamp
    valid_until = claim[-2]
    current_time = web3.eth.get_block("latest").get("timestamp")
    if current_time >= valid_until:
        print("Request already expired")
        return

    tx_hash = request_manager.functions.challengeClaim(claim_id).transact(
        {"value": highest_stake + 1}
    )
    web3.eth.wait_for_transaction_receipt(tx_hash, poll_latency=1.0)

    print(f"Transaction sent, tx_hash: {tx_hash.hex()}")


@click.option(
    "--request-id",
    type=str,
    callback=validate_bytes,
    help="Request id of expired request",
)
@cli.command("withdraw-expired")
@pass_args
def withdraw_expired(
    web3: Web3,
    contracts: dict[str, Contract],
    request_id: bytes,
) -> None:
    """Withdraw an expired Beamer request"""

    request_manager = contracts["RequestManager"]
    request = request_manager.functions.requests(request_id).call()
    is_withdrawn = request_manager.functions.isWithdrawn(request_id).call()
    active_claims = request[7]
    valid_until = request[8]
    current_time = web3.eth.get_block("latest").get("timestamp")

    if current_time < valid_until:
        print("Request not expired yet. Cannot withdraw.")
        return
    if is_withdrawn:
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
    """Whitelist an LP"""

    fill_manager = contracts["FillManager"]
    request_manager = contracts["RequestManager"]

    if not request_manager.functions.allowedLps(address).call():
        tx_hash = request_manager.functions.addAllowedLp(address).transact()
        web3.eth.wait_for_transaction_receipt(tx_hash, poll_latency=1.0)
        print(f"Whitelisted in request manager, tx_hash: {tx_hash.hex()}")

    if not fill_manager.functions.allowedLps(address).call():
        tx_hash = fill_manager.functions.addAllowedLp(address).transact()
        web3.eth.wait_for_transaction_receipt(tx_hash, poll_latency=1.0)
        print(f"Whitelisted in fill manager, tx_hash: {tx_hash.hex()}")


@cli.command("update-fees")
@click.option(
    "--min-fee-ppm",
    type=int,
    required=True,
    help="Margin in parts per million to add on top of the transfer costs",
)
@click.option(
    "--lp-fee-ppm", type=int, required=True, help="LP fee in ppm to add on top of transfer amount"
)
@click.option(
    "--protocol-fee-ppm",
    type=int,
    required=True,
    help="Protocol fee in ppm to add on top of transfer amount",
)
@pass_args
def update_fees(
    web3: Web3,  # pylint:disable=unused-argument
    contracts: dict[str, Contract],
    min_fee_ppm: int,
    lp_fee_ppm: int,
    protocol_fee_ppm: int,
) -> None:
    """Update fees in Request Manager. Must be done by owner."""

    request_manager = contracts["RequestManager"]
    tx_receipt = transact(
        request_manager.functions.updatefees(min_fee_ppm, lp_fee_ppm, protocol_fee_ppm)
    )

    print(f"Transaction sent, tx_hash: {tx_receipt['transactionHash'].hex()}")


@cli.command("update-token")
@click.argument("token-address", type=str, metavar="ADDRESS", callback=validate_address)
@click.option("--transfer-limit", type=int, help="New transfer limit of token")
@click.option(
    "--eth-in-token", type=int, help="ETH/token conversion rate, number of token per 1 ETH"
)
@pass_args
def update_token(
    web3: Web3,  # pylint:disable=unused-argument
    contracts: dict[str, Contract],
    token_address: Address,
    transfer_limit: int,
    eth_in_token: int,
) -> None:
    """
    Update transfer limit and Eth/token conversion rate in Request Manager.
    Must be done by owner.
    """

    request_manager = contracts["RequestManager"]
    params = (transfer_limit, eth_in_token)
    token_data = list(request_manager.functions.tokens(token_address).call())
    new_token_data = tuple(value or token_data[i] for i, value in enumerate(params))
    tx_receipt = transact(request_manager.functions.updateToken(token_address, new_token_data))

    print(f"Transaction sent, tx_hash: {tx_receipt['transactionHash'].hex()}")


@cli.command("invalidate-fill")
@click.argument("request-id", type=str, callback=validate_bytes)
@click.argument("fill-id", type=str, callback=validate_bytes)
@click.argument("source-chain-id", type=int)
@pass_args
def invalidate_fill(
    web3: Web3,  # pylint:disable=unused-argument
    contracts: dict[str, Contract],
    request_id: bytes,
    fill_id: bytes,
    source_chain_id: int,
) -> None:
    """Invalidate a fill ID."""

    fill_manager = contracts["FillManager"]
    func = fill_manager.functions.invalidateFill(request_id, fill_id, source_chain_id)
    tx_receipt = transact(func)

    print(f"Transaction sent, tx_hash: {tx_receipt['transactionHash'].hex()}")


if __name__ == "__main__":
    cli()
