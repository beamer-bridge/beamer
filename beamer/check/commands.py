import json
import random
import sys
import time
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Any, NamedTuple

import apischema
import click
import structlog
from apischema import schema
from eth_account.account import LocalAccount
from eth_utils import to_checksum_address, to_wei
from hexbytes import HexBytes
from web3.constants import ADDRESS_ZERO
from web3.contract import Contract, ContractConstructor
from web3.contract.contract import ContractFunction
from web3.types import TxReceipt

import beamer.chains
import beamer.contracts
import beamer.util
from beamer.contracts import ABIManager, obtain_contract
from beamer.relayer import RelayerError, run_relayer_for_tx
from beamer.typing import URL, ChainId, ClaimId, FillId, RequestId, TokenAmount
from beamer.util import ChainIdParam, create_request_id, get_ERC20_abi, make_web3

log = structlog.get_logger(__name__)


@dataclass
class Invalidation:
    proof_source: ChainId = field(metadata=schema(min=1))
    proof_target: ChainId = field(metadata=schema(min=1))
    request_id: RequestId
    fill_id: FillId
    txhash: HexBytes
    finalization_timestamp: datetime | None


def _transact(func: ContractConstructor | ContractFunction, **kwargs: Any) -> TxReceipt:
    try:
        receipt = beamer.util.transact(func, **kwargs)
    except beamer.util.TransactionFailed as exc:
        log.error("Transaction failed", exc=exc)
        sys.exit(1)

    txhash = receipt.transactionHash.hex()  # type: ignore
    log.info("Transaction sent", block=receipt.blockNumber, txhash=txhash)  # type: ignore
    return receipt


def _make_invalidation(
    fill_manager: Contract, proof_source: ChainId, proof_target: ChainId
) -> Invalidation:
    # Mark check-related fill IDs so that we can distiguish them
    # on chain from other invalidations, if the need arises.
    fill_id = FillId(b"beamer check " + random.randbytes(19))
    assert len(fill_id) == 32

    # The nonce is only 96 bits.
    nonce = random.randint(0, 2**96 - 1)

    func = fill_manager.functions.invalidateFill(
        proof_target, ADDRESS_ZERO, ADDRESS_ZERO, TokenAmount(0), nonce, fill_id
    )
    receipt = _transact(func)

    request_id = create_request_id(
        proof_target,
        proof_source,
        to_checksum_address(ADDRESS_ZERO),
        to_checksum_address(ADDRESS_ZERO),
        TokenAmount(0),
        nonce,
    )
    return Invalidation(
        proof_source=proof_source,
        proof_target=proof_target,
        request_id=request_id,
        fill_id=fill_id,
        txhash=receipt.transactionHash,  # type: ignore
        finalization_timestamp=None,
    )


@click.group()
def check() -> None:
    pass


@check.command("initiate-l1-invalidations")
@click.option(
    "--keystore-file",
    type=click.Path(exists=True, file_okay=True, dir_okay=False, path_type=Path),
    required=True,
    metavar="PATH",
    help="Path to the keystore file.",
)
@click.password_option(
    "--password",
    type=str,
    default="",
    prompt=False,
    help="The password needed to unlock the keystore file.",
)
@click.option(
    "--rpc-file",
    type=click.Path(exists=True, file_okay=True, dir_okay=False, path_type=Path),
    required=True,
    help="Path to the RPC config file.",
)
@click.option(
    "--artifacts-dir",
    type=click.Path(exists=True, file_okay=False, dir_okay=True, path_type=Path),
    required=True,
    help="The directory containing deployment artifacts.",
)
@click.option(
    "--abi-dir",
    type=click.Path(exists=True, file_okay=False, dir_okay=True, path_type=Path),
    required=True,
    help="Path to the directory with contract ABIs.",
)
@click.option(
    "--output",
    type=click.Path(file_okay=True, dir_okay=False, path_type=Path),
    required=True,
    help="Path to store the invalidation info at, which can be later used for verification.",
)
@click.option(
    "--count",
    type=click.IntRange(1),
    default=1,
    show_default=True,
    help="Number of invalidations to create, per (PROOF_SOURCE, PROOF_TARGET) pair.",
)
@click.argument("proof-source", type=ChainIdParam())
@click.argument("proof-target", type=ChainIdParam(), nargs=-1, required=True)
def initiate_l1_invalidations(
    keystore_file: Path,
    password: str,
    rpc_file: Path,
    artifacts_dir: Path,
    abi_dir: Path,
    output: Path,
    count: int,
    proof_source: ChainId,
    proof_target: tuple[ChainId],
) -> None:
    """Initiate L1 invalidations from chain PROOF_SOURCE to each PROOF_TARGET.
    PROOF_SOURCE and PROOF_TARGET are chain IDs."""
    beamer.util.setup_logging(log_level="DEBUG", log_json=False)

    account = beamer.util.account_from_keyfile(keystore_file, password)
    log.info("Loaded keystore file", address=account.address)

    abi_manager = ABIManager(abi_dir)
    deployment = beamer.artifacts.load(artifacts_dir, proof_source)

    rpc_info = beamer.util.load_rpc_info(rpc_file)
    url = rpc_info[proof_source]
    w3 = make_web3(url, account)
    assert w3.eth.chain_id == proof_source
    log.info("Connected to RPC", url=url)

    fill_manager = obtain_contract(w3, abi_manager, deployment, "FillManager")
    request_manager = obtain_contract(w3, abi_manager, deployment, "RequestManager")

    # Step 1: issue invalidateFill transactions.
    # This will produce invalidations without finalization_timestamp.
    #
    # Note that if the output file already contains invalidations from
    # proof_source to a specific proof_target, we will only issue  as many new
    # invalidations as is necessary to reach `count`.
    if output.exists():
        with output.open("rt") as f:
            data = json.load(f)
        invalidations = apischema.deserialize(list[Invalidation], data)
    else:
        invalidations = []

    existing_counts: Counter[ChainId] = Counter()
    for invalidation in invalidations:
        if invalidation.proof_source == proof_source:
            existing_counts[invalidation.proof_target] += 1

    sent = 0
    for chain_id in proof_target:
        for _ in range(existing_counts[chain_id], count):
            invalidation = _make_invalidation(fill_manager, proof_source, chain_id)
            invalidations.append(invalidation)
            log.info(
                "Sent invalidation",
                idx=len(invalidations) - 1,
                proof_source=proof_source,
                proof_target=chain_id,
            )
            sent += 1

            # Write the output immediately so that we have at least partial data
            # in case an error occurs during invalidation for the next chain.
            data = apischema.serialize(invalidations)
            with output.open("wt") as f:
                json.dump(data, f, indent=4)

    # Step 2: complete invalidations with finalization_timestamp.
    # This will prove invalidations if necessary (Optimism chains).
    descriptor = beamer.chains.get_chain_descriptor(invalidation.proof_source)
    assert descriptor is not None

    finality_period = request_manager.functions.chains(proof_source).call()[0]
    for idx, invalidation in enumerate(invalidations):
        if invalidation.proof_source != proof_source:
            # Skip unrelated invalidations.
            continue
        if invalidation.finalization_timestamp is not None:
            continue

        if descriptor.bedrock:
            # For Optimism-based chains we need to first invoke the relayer to
            # prepare the message for later L1 execution. The finalization
            # period starts only after this is done.
            result = None
            while result is None:
                try:
                    log.debug("Starting relayer", txhash=invalidation.txhash)
                    result = run_relayer_for_tx(
                        l1_rpc=rpc_info[deployment.base.chain_id],
                        l2_relay_from_rpc_url=rpc_info[invalidation.proof_source],
                        l2_relay_to_rpc_url=rpc_info[invalidation.proof_target],
                        account=account,
                        tx_hash=invalidation.txhash,
                        prove_tx=True,
                    )
                except RelayerError as exc:
                    log.error("Relayer failed", exc=exc)
                    time.sleep(30)
            timestamp = datetime.utcfromtimestamp(float(result))
            log.info("Relayer succeeded", thxash=invalidation.txhash)
        else:
            transaction = w3.eth.get_transaction(invalidation.txhash)
            block = w3.eth.get_block(transaction["blockNumber"])
            timestamp = datetime.utcfromtimestamp(block["timestamp"])

        # Compute the timestamp of message finalization.
        invalidation.finalization_timestamp = timestamp + timedelta(seconds=finality_period)

        data = apischema.serialize(invalidations)
        with output.open("wt") as f:
            json.dump(data, f, indent=4)
        log.info(
            "Invalidation complete",
            idx=idx,
            proof_source=invalidation.proof_source,
            proof_target=invalidation.proof_target,
            finalization_timestamp=invalidation.finalization_timestamp.isoformat(),
        )
    log.info(
        "Invalidations initiated successfully",
        path=str(output),
        proof_source=proof_source,
        sent=sent,
        total=len(invalidations),
    )


# Status of an invalidation during the verification process.
Status = Enum("Status", ("FAILED", "READY", "VERIFIED"))


class Context(NamedTuple):
    abi_manager: ABIManager
    artifacts_dir: Path
    account: LocalAccount | None
    rpc_info: dict[ChainId, URL]


def _obtain_request_manager(ctx: Context, chain_id: ChainId) -> Contract:
    deployment = beamer.artifacts.load(ctx.artifacts_dir, chain_id)
    url = ctx.rpc_info[chain_id]
    w3 = make_web3(url, ctx.account)
    assert w3.eth.chain_id == chain_id

    return obtain_contract(w3, ctx.abi_manager, deployment, "RequestManager")


def _verify_without_relaying(
    ctx: Context, pair: tuple[ChainId, ChainId], invalidation: Invalidation
) -> Status:
    # First check the finalization timestamp.
    if (
        invalidation.finalization_timestamp is None
        or datetime.utcnow() <= invalidation.finalization_timestamp
    ):
        log.error(
            "Invalidation not yet finalized, skipping",
            txhash=invalidation.txhash,
            proof_source=pair[0],
            proof_target=pair[1],
        )
        return Status.FAILED

    # Check the request manager directly to see if it has been already verifed.
    request_manager = _obtain_request_manager(ctx, invalidation.proof_target)
    if request_manager.functions.isInvalidFill(
        invalidation.request_id, invalidation.fill_id
    ).call():
        log.info(
            "Invalidation verified successfully",
            txhash=invalidation.txhash,
            proof_source=pair[0],
            proof_target=pair[1],
        )
        return Status.VERIFIED
    return Status.READY


def _relay_and_verify(
    ctx: Context, pair: tuple[ChainId, ChainId], invalidation: Invalidation
) -> bool:
    assert ctx.account is not None
    deployment = beamer.artifacts.load(ctx.artifacts_dir, invalidation.proof_target)
    txhash = invalidation.txhash
    log.debug("Starting relayer", txhash=txhash)
    try:
        run_relayer_for_tx(
            l1_rpc=ctx.rpc_info[deployment.base.chain_id],
            l2_relay_from_rpc_url=ctx.rpc_info[invalidation.proof_source],
            l2_relay_to_rpc_url=ctx.rpc_info[invalidation.proof_target],
            account=ctx.account,
            tx_hash=invalidation.txhash,
        )
    except RelayerError as exc:
        log.error(
            "Relayer failed", exc=exc, txhash=txhash, proof_source=pair[0], proof_target=pair[1]
        )
        return False

    log.info("Relayer succeeded", thxash=txhash)

    # Check the request manager, the invalidation should have arrived.
    request_manager = _obtain_request_manager(ctx, invalidation.proof_target)
    if request_manager.functions.isInvalidFill(
        invalidation.request_id, invalidation.fill_id
    ).call():
        log.info(
            "Invalidation verified successfully",
            txhash=txhash,
            proof_source=pair[0],
            proof_target=pair[1],
        )
        return True

    log.error(
        "Invalidation failed after relaying",
        txhash=txhash,
        proof_source=pair[0],
        proof_target=pair[1],
    )
    return False


@check.command("verify-l1-invalidations")
@click.option(
    "--keystore-file",
    type=click.Path(exists=True, file_okay=True, dir_okay=False, path_type=Path),
    required=True,
    metavar="PATH",
    help="Path to the keystore file.",
)
@click.password_option(
    "--password",
    type=str,
    default="",
    prompt=False,
    help="The password needed to unlock the keystore file.",
)
@click.option(
    "--rpc-file",
    type=click.Path(exists=True, file_okay=True, dir_okay=False, path_type=Path),
    required=True,
    help="Path to the RPC config file.",
)
@click.option(
    "--artifacts-dir",
    type=click.Path(exists=True, file_okay=False, dir_okay=True, path_type=Path),
    required=True,
    help="The directory containing deployment artifacts.",
)
@click.option(
    "--abi-dir",
    type=click.Path(exists=True, file_okay=False, dir_okay=True, path_type=Path),
    required=True,
    help="Path to the directory with contract ABIs.",
)
@click.argument(
    "file", type=click.Path(exists=True, file_okay=True, dir_okay=False, path_type=Path)
)
def verify_l1_invalidations(
    keystore_file: Path,
    password: str,
    rpc_file: Path,
    artifacts_dir: Path,
    abi_dir: Path,
    file: Path,
) -> None:
    """Verify L1 invalidations stored in FILE."""
    beamer.util.setup_logging(log_level="DEBUG", log_json=False)

    account = beamer.util.account_from_keyfile(keystore_file, password)
    log.info("Loaded keystore file", address=account.address)

    abi_manager = ABIManager(abi_dir)
    rpc_info = beamer.util.load_rpc_info(rpc_file)
    ctx = Context(
        abi_manager=abi_manager, account=account, artifacts_dir=artifacts_dir, rpc_info=rpc_info
    )

    with file.open("rt") as f:
        data = json.load(f)

    # Group all invalidations by chain pair (proof_source, proof_target).
    pairs = defaultdict(list)
    for invalidation in apischema.deserialize(list[Invalidation], data):
        pair = invalidation.proof_source, invalidation.proof_target
        pairs[pair].append(invalidation)

    # First, place each invalidation into one of the following bins:
    # - failed:   invalidations that failed, e.g. due to not being finalized
    # - ready:    invalidations that are finalized and ready for relaying
    # - verified: invalidations that are already verified
    failed = defaultdict(list)
    ready = defaultdict(list)
    verified = defaultdict(list)

    while pairs:
        pair, invalidations = pairs.popitem()
        for invalidation in invalidations:
            match _verify_without_relaying(ctx, pair, invalidation):
                case Status.FAILED:
                    failed[pair].append(invalidation)
                case Status.READY:
                    ready[pair].append(invalidation)
                case Status.VERIFIED:
                    verified[pair].append(invalidation)

    # Now invoke the relayer for all invalidations that are ready,
    # except those whose chain pair has already been verified.
    while ready:
        pair, invalidations = ready.popitem()
        for invalidation in invalidations:
            if pair in verified:
                log.info(
                    "Verified invalidation already exists for chain pair, skipping",
                    txhash=invalidation.txhash,
                    proof_source=pair[0],
                    proof_target=pair[1],
                )
                continue

            if _relay_and_verify(ctx, pair, invalidation):
                verified[pair].append(invalidation)
            else:
                failed[pair].append(invalidation)

    # If pair is present in both failed and verified, that's considered fine
    # since different invalidations for the same pair can have sufficiently
    # different finalization timestamps such that one is finalized and the
    # other is not. As long as all chain pairs in failed are also in verified,
    # we should report success.
    unverified = set(failed) - set(verified)
    if unverified:
        log.error("Error(s) occurred during verification", unverified=unverified)
        sys.exit(1)

    log.info("Invalidations for all chain pairs successful", verified=len(verified))


@dataclass
class Challenge:
    request_chain: ChainId = field(metadata=schema(min=1))
    fill_chain: ChainId = field(metadata=schema(min=1))
    request_id: RequestId
    claim_id: ClaimId | None
    create_request_txhash: HexBytes
    claim_request_txhash: HexBytes | None
    challenge_claim_txhash: HexBytes | None
    finalization_timestamp: datetime | None


def _find_token(ctx: Context, chain_id: ChainId, symbol: str) -> Contract | None:
    deployment = beamer.artifacts.load(ctx.artifacts_dir, chain_id)
    assert deployment.chain is not None

    url = ctx.rpc_info[chain_id]
    w3 = make_web3(url, ctx.account)
    assert w3.eth.chain_id == chain_id

    request_manager = obtain_contract(w3, ctx.abi_manager, deployment, "RequestManager")
    from_block = deployment.chain.contracts["RequestManager"].deployment_block
    logs = request_manager.events.TokenUpdated.get_logs(fromBlock=from_block)  # type: ignore
    for log in logs:
        address = log.args["tokenAddress"]
        token = w3.eth.contract(abi=get_ERC20_abi(), address=address)
        if token.functions.symbol().call() == symbol:
            return token
    return None


def _wait_for_agent_to_claim(ctx: Context, challenge: Challenge) -> None:
    request_manager = _obtain_request_manager(ctx, challenge.request_chain)
    transaction = request_manager.w3.eth.get_transaction(challenge.create_request_txhash)
    from_block = transaction["blockNumber"]
    argument_filters = dict(requestId=challenge.request_id)
    log.debug(
        "Waiting for agent to claim",
        chain_id=challenge.request_chain,
        request_id=challenge.request_id,
    )
    while True:
        events = request_manager.events.ClaimMade.get_logs(  # type: ignore
            fromBlock=from_block, argument_filters=argument_filters
        )
        if events:
            assert len(events) == 1
            break
        time.sleep(1)

    event = events[0]
    challenge.claim_id = ClaimId(event.args["claimId"])
    challenge.claim_request_txhash = event.transactionHash


def _create_transfer_request(
    ctx: Context, request_chain: ChainId, fill_chain: ChainId, symbol: str, target_token: Contract
) -> Challenge:
    assert ctx.account is not None
    request_manager = _obtain_request_manager(ctx, request_chain)
    validity_period = request_manager.functions.MIN_VALIDITY_PERIOD().call()

    source_token = _find_token(ctx, request_chain, symbol)
    if source_token is None:
        log.error("Could not find token", token=symbol, chain_id=request_chain)
        sys.exit(1)

    _transact(source_token.functions.approve(request_manager.address, 1))

    func = request_manager.functions.createRequest(
        fill_chain,
        source_token.address,
        target_token.address,
        ctx.account.address,
        TokenAmount(1),
        validity_period,
    )
    receipt = _transact(func)
    event = request_manager.events.RequestCreated().process_log(receipt["logs"][0])
    request_id = RequestId(event.args["requestId"])
    txhash = receipt.transactionHash.hex()  # type: ignore
    log.info(
        "Created transfer request",
        request_chain=request_chain,
        fill_chain=fill_chain,
        txhash=txhash,
    )

    return Challenge(
        request_chain=request_chain,
        fill_chain=fill_chain,
        request_id=request_id,
        claim_id=None,
        create_request_txhash=HexBytes(txhash),
        claim_request_txhash=None,
        challenge_claim_txhash=None,
        finalization_timestamp=None,
    )


def _challenge_claim(ctx: Context, challenge: Challenge, stake: float) -> None:
    request_manager = _obtain_request_manager(ctx, challenge.request_chain)
    func = request_manager.functions.challengeClaim(challenge.claim_id)
    receipt = _transact(func, value=to_wei(stake, "ether"))
    txhash = receipt.transactionHash.hex()  # type: ignore
    log.info(
        "Challenged claim",
        chain_id=challenge.request_chain,
        claim_id=challenge.claim_id,
        txhash=txhash,
    )

    block = request_manager.w3.eth.get_block(receipt["blockNumber"])
    finality_period = request_manager.functions.chains(challenge.fill_chain).call()[0]
    timestamp = datetime.utcfromtimestamp(block["timestamp"])
    challenge.challenge_claim_txhash = HexBytes(txhash)
    challenge.finalization_timestamp = timestamp + timedelta(seconds=finality_period)


@check.command("initiate-challenges")
@click.option(
    "--keystore-file",
    type=click.Path(exists=True, file_okay=True, dir_okay=False, path_type=Path),
    required=True,
    metavar="PATH",
    help="Path to the keystore file.",
)
@click.password_option(
    "--password",
    type=str,
    default="",
    prompt=False,
    help="The password needed to unlock the keystore file.",
)
@click.option(
    "--rpc-file",
    type=click.Path(exists=True, file_okay=True, dir_okay=False, path_type=Path),
    required=True,
    help="Path to the RPC config file.",
)
@click.option(
    "--artifacts-dir",
    type=click.Path(exists=True, file_okay=False, dir_okay=True, path_type=Path),
    required=True,
    help="The directory containing deployment artifacts.",
)
@click.option(
    "--abi-dir",
    type=click.Path(exists=True, file_okay=False, dir_okay=True, path_type=Path),
    required=True,
    help="Path to the directory with contract ABIs.",
)
@click.option(
    "--output",
    type=click.Path(file_okay=True, dir_okay=False, path_type=Path),
    required=True,
    help="Path to store the challenge info at, which can be later used for verification.",
)
@click.option(
    "symbol",
    "--token",
    type=str,
    required=True,
    help="Symbol of the token to be used for challenges (e.g. USDC).",
)
@click.option(
    "--stake",
    type=click.FloatRange(0.1),
    default=0.1,
    show_default=True,
    help="Stake amount, in ETH.",
)
@click.argument("fill-chain", type=ChainIdParam())
@click.argument("request-chain", type=ChainIdParam(), nargs=-1, required=True)
def initiate_challenges(
    keystore_file: Path,
    password: str,
    rpc_file: Path,
    artifacts_dir: Path,
    abi_dir: Path,
    output: Path,
    symbol: str,
    stake: float,
    fill_chain: ChainId,
    request_chain: tuple[ChainId],
) -> None:
    """Create one transfer for each (REQUEST_CHAIN, FILL_CHAIN) pair and challenge
    agent's claims on those transfers. REQUEST_CHAIN and FILL_CHAIN are chain IDs."""
    beamer.util.setup_logging(log_level="DEBUG", log_json=False)

    account = beamer.util.account_from_keyfile(keystore_file, password)
    log.info("Loaded keystore file", address=account.address)

    abi_manager = ABIManager(abi_dir)
    rpc_info = beamer.util.load_rpc_info(rpc_file)

    ctx = Context(
        abi_manager=abi_manager, account=account, artifacts_dir=artifacts_dir, rpc_info=rpc_info
    )
    target_token = _find_token(ctx, fill_chain, symbol)
    if target_token is None:
        log.error("Could not find token", token=symbol, chain_id=fill_chain)
        sys.exit(1)

    if output.exists():
        with output.open("rt") as f:
            data = json.load(f)
        challenges = apischema.deserialize(list[Challenge], data)
    else:
        challenges = []

    existing_pairs = frozenset((ch.request_chain, ch.fill_chain) for ch in challenges)

    # Step 1: for each request chain, make a transfer request to fill chain.
    for chain_id in request_chain:
        # Don't to anything if there's already a challenge for this
        # (request_chain, fill_chain) pair.
        if (chain_id, fill_chain) in existing_pairs:
            continue

        challenge = _create_transfer_request(ctx, chain_id, fill_chain, symbol, target_token)
        challenges.append(challenge)

        # Write the output immediately so that we have at least partial data in
        # case an error occurs.
        data = apischema.serialize(challenges)
        with output.open("wt") as f:
            json.dump(data, f, indent=4)

    # Step 2: for each request, once a claim is done, issue a challenge.
    for challenge in challenges:
        if challenge.claim_request_txhash is None:
            _wait_for_agent_to_claim(ctx, challenge)

        if challenge.challenge_claim_txhash is None:
            _challenge_claim(ctx, challenge, stake)

        data = apischema.serialize(challenges)
        with output.open("wt") as f:
            json.dump(data, f, indent=4)

    log.info("All challenges initiated succesfully")
