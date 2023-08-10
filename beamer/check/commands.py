import json
import random
import sys
import time
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from subprocess import CalledProcessError

import apischema
import click
import structlog
from apischema import schema
from eth_utils import to_checksum_address
from hexbytes import HexBytes
from web3.constants import ADDRESS_ZERO
from web3.contract import Contract, ContractConstructor
from web3.contract.contract import ContractFunction
from web3.types import TxReceipt

import beamer.chains
import beamer.contracts
import beamer.util
from beamer.contracts import ABIManager, obtain_contract
from beamer.relayer import run_relayer_for_tx
from beamer.typing import ChainId, FillId, RequestId, TokenAmount
from beamer.util import ChainIdParam, create_request_id, make_web3

log = structlog.get_logger(__name__)


@dataclass
class Invalidation:
    proof_source: ChainId = field(metadata=schema(min=1))
    proof_target: ChainId = field(metadata=schema(min=1))
    request_id: RequestId
    fill_id: FillId
    txhash: HexBytes
    finalization_timestamp: datetime | None


def _transact(func: ContractConstructor | ContractFunction) -> TxReceipt:
    try:
        receipt = beamer.util.transact(func)
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
                except (CalledProcessError, RuntimeError) as exc:
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
