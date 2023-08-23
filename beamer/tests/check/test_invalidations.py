import itertools
import json
import logging
from itertools import repeat
from pathlib import Path

import ape
import apischema
import pytest
from freezegun import freeze_time

import beamer.check.commands
from beamer.check.commands import Invalidation
from beamer.tests.util import (
    CommandFailed,
    deploy,
    get_repo_root,
    run_command,
    write_keystore_file,
)
from beamer.typing import ChainId


def _iter_transactions(w3, from_block, to_block):
    for block_number in range(from_block, to_block + 1):
        block = w3.eth.get_block(block_number)
        yield from block.transactions


def _load_invalidations(path: Path):
    with path.open("rt") as f:
        data = json.load(f)

    return apischema.deserialize(list[Invalidation], data)


def _initiate(keystore_file, password, rpc_file, artifacts_dir, output, count, *chain_ids):
    root = get_repo_root()
    run_command(
        beamer.check.commands.initiate_l1_invalidations,
        "--keystore-file",
        keystore_file,
        "--password",
        password,
        "--rpc-file",
        rpc_file,
        "--abi-dir",
        f"{root}/contracts/.build/",
        "--artifacts-dir",
        artifacts_dir,
        "--output",
        output,
        "--count",
        count,
        *map(str, chain_ids),
    )


@pytest.mark.parametrize("count", (1, 3))
def test_initiate_invalidations(tmp_path, deployer, count):
    password = "test"
    keystore_file = tmp_path / f"{deployer.address}.json"
    write_keystore_file(keystore_file, deployer.private_key, password)

    rpc_file, artifact = deploy(deployer, tmp_path)
    artifacts_dir = Path(artifact).parent

    output = tmp_path / "invalidations.json"
    chain_id = ape.chain.chain_id
    # We run the command with 2 proof targets: current chain and a dummy chain.
    proof_targets = chain_id, 98765
    _initiate(
        keystore_file, password, rpc_file, artifacts_dir, output, count, chain_id, *proof_targets
    )

    invalidations = _load_invalidations(output)
    assert len(invalidations) == count * len(proof_targets)

    w3 = ape.chain.provider.web3
    targets = itertools.chain.from_iterable(repeat(x, count) for x in proof_targets)
    for invalidation, proof_target in zip(invalidations, targets):
        assert invalidation.proof_source == chain_id
        assert invalidation.proof_target == proof_target

        receipt = w3.eth.get_transaction_receipt(invalidation.txhash)
        fill_manager = ape.project.FillManager.at(receipt.to)
        event = fill_manager.FillInvalidated.from_receipt(receipt)[0]
        assert event.event_arguments == dict(
            requestId=invalidation.request_id, fillId=invalidation.fill_id
        )


def test_initiate_invalidations_resume(tmp_path, deployer):
    password = "test"
    keystore_file = tmp_path / f"{deployer.address}.json"
    write_keystore_file(keystore_file, deployer.private_key, password)

    rpc_file, artifact = deploy(deployer, tmp_path)
    artifacts_dir = Path(artifact).parent

    output = tmp_path / "invalidations.json"
    chain_id = ape.chain.chain_id

    def send_invalidations(count, proof_targets):
        block_before = ape.chain.blocks[-1].number
        assert block_before is not None
        _initiate(
            keystore_file,
            password,
            rpc_file,
            artifacts_dir,
            output,
            count,
            chain_id,
            *proof_targets,
        )

        block_after = ape.chain.blocks[-1].number
        assert block_after is not None

        invalidations = _load_invalidations(output)

        w3 = ape.chain.provider.web3
        txhashes = tuple(_iter_transactions(w3, block_before + 1, block_after))
        return invalidations, txhashes

    # First, just send a single invalidation for one chain so we have an output file.
    invalidations, txhashes = send_invalidations(1, (31,))
    assert len(invalidations) == len(txhashes) == 1

    # We now request 3 invalidations to be sent per chain pair. Since the
    # output file now exists and contains 1 invalidation, we expect only 2 new
    # invalidations.
    invalidations, txhashes = send_invalidations(3, (31,))
    assert len(txhashes) == 2
    assert len(invalidations) == 3
    assert all(x.txhash == y for x, y in zip(invalidations[1:], txhashes, strict=True))

    # We now introduce a new chain, but leave the count at 3. We expect 3 new
    # invalidations, all for the new chain.
    invalidations, txhashes = send_invalidations(3, (31, 32))
    assert len(txhashes) == 3
    assert len(invalidations) == 6
    assert all(x.proof_target == 31 for x in invalidations[:3])
    assert all(x.proof_target == 32 for x in invalidations[3:])
    assert all(x.txhash == y for x, y in zip(invalidations[3:], txhashes, strict=True))

    # Increase the count to 4. This means we expect 1 additional invalidation
    # to be sent per each proof target, so 2 new invalidations in total.
    invalidations, txhashes = send_invalidations(4, (31, 32))
    assert len(txhashes) == 2
    assert len(invalidations) == 8
    assert invalidations[6].proof_target == 31
    assert invalidations[7].proof_target == 32
    assert all(x.txhash == y for x, y in zip(invalidations[6:], txhashes, strict=True))

    # Finally, use the count of 1 and make sure no new invalidations are sent.
    invalidations, txhashes = send_invalidations(1, (31, 32))
    assert not txhashes
    assert len(invalidations) == 8


def _verify(keystore_file, password, rpc_file, artifacts_dir, output):
    chain_id = ChainId(ape.chain.chain_id)
    deployment = beamer.artifacts.load(artifacts_dir, chain_id)
    assert deployment.chain is not None
    deployment_base = beamer.artifacts.load_base(artifacts_dir)
    assert deployment_base.base is not None

    env = dict(
        ETHEREUM_L2_MESSENGER=deployment.chain.contracts["EthereumL2Messenger"].address,
        RESOLVER=deployment_base.base.contracts["Resolver"].address,
    )

    root = get_repo_root()
    run_command(
        beamer.check.commands.verify_l1_invalidations,
        "--keystore-file",
        keystore_file,
        "--password",
        password,
        "--rpc-file",
        rpc_file,
        "--abi-dir",
        f"{root}/contracts/.build/",
        "--artifacts-dir",
        artifacts_dir,
        str(output),
        env=env,
    )


def test_verify_invalidation(tmp_path, deployer, caplog):
    password = "test"
    keystore_file = tmp_path / f"{deployer.address}.json"
    write_keystore_file(keystore_file, deployer.private_key, password)

    rpc_file, artifact = deploy(deployer, tmp_path)
    artifacts_dir = Path(artifact).parent

    output = tmp_path / "invalidations.json"
    chain_id = ChainId(ape.chain.chain_id)

    # Initiate two invalidations from current chain to the same chain.
    _initiate(keystore_file, password, rpc_file, artifacts_dir, output, 2, chain_id, chain_id)

    caplog.clear()
    caplog.set_level(logging.DEBUG)
    _verify(keystore_file, password, rpc_file, artifacts_dir, output)
    assert any("Starting relayer" in msg for msg in caplog.messages)
    assert any("Invalidation verified successfully" in msg for msg in caplog.messages)
    assert any(
        "Verified invalidation already exists for chain pair, skipping" in msg
        for msg in caplog.messages
    )

    invalidation = _load_invalidations(output)[0]

    deployment = beamer.artifacts.load(artifacts_dir, chain_id)
    assert deployment.chain is not None

    address = deployment.chain.contracts["RequestManager"].address
    request_manager = ape.project.RequestManager.at(address)
    assert request_manager.isInvalidFill(invalidation.request_id, invalidation.fill_id)


def test_verify_same_invalidation_twice(tmp_path, deployer, caplog):
    password = "test"
    keystore_file = tmp_path / f"{deployer.address}.json"
    write_keystore_file(keystore_file, deployer.private_key, password)

    rpc_file, artifact = deploy(deployer, tmp_path)
    artifacts_dir = Path(artifact).parent

    output = tmp_path / "invalidations.json"
    chain_id = ChainId(ape.chain.chain_id)

    # Initiate one invalidation from current chain to the same chain.
    _initiate(keystore_file, password, rpc_file, artifacts_dir, output, 1, chain_id, chain_id)
    _verify(keystore_file, password, rpc_file, artifacts_dir, output)

    # Check that the second invocation doesn't start the relayer.
    caplog.clear()
    caplog.set_level(logging.DEBUG)
    _verify(keystore_file, password, rpc_file, artifacts_dir, output)
    assert any("Invalidation verified successfully" in msg for msg in caplog.messages)
    assert not any("Starting relayer" in msg for msg in caplog.messages)


def test_verify_invalidation_before_finalization(tmp_path, deployer, caplog):
    password = "test"
    keystore_file = tmp_path / f"{deployer.address}.json"
    write_keystore_file(keystore_file, deployer.private_key, password)

    rpc_file, artifact = deploy(deployer, tmp_path)
    artifacts_dir = Path(artifact).parent

    output = tmp_path / "invalidations.json"
    chain_id = ChainId(ape.chain.chain_id)

    # Initiate one invalidation from current chain to the same chain.
    _initiate(keystore_file, password, rpc_file, artifacts_dir, output, 1, chain_id, chain_id)

    caplog.clear()
    caplog.set_level(logging.DEBUG)
    with pytest.raises(CommandFailed):
        with freeze_time("1899-03-08"):
            _verify(keystore_file, password, rpc_file, artifacts_dir, output)

    assert any("Invalidation not yet finalized, skipping" in msg for msg in caplog.messages)
    assert any("Error(s) occurred during verification" in msg for msg in caplog.messages)


def test_verify_invalidation_when_relayer_fails(tmp_path, deployer, caplog):
    password = "test"
    keystore_file = tmp_path / f"{deployer.address}.json"
    write_keystore_file(keystore_file, deployer.private_key, password)

    rpc_file, artifact = deploy(deployer, tmp_path)
    artifacts_dir = Path(artifact).parent

    output = tmp_path / "invalidations.json"
    chain_id = ChainId(ape.chain.chain_id)

    # Initiate one invalidation from current chain to the same chain.
    _initiate(keystore_file, password, rpc_file, artifacts_dir, output, 1, chain_id, chain_id)

    caplog.clear()
    caplog.set_level(logging.DEBUG)

    # Instead of using _verify, which prepares a proper environment for the relayer,
    # here we're just going to use run_command directly and intentionally omit environment
    # variables so that the relayer fails.
    root = get_repo_root()
    with pytest.raises(CommandFailed):
        run_command(
            beamer.check.commands.verify_l1_invalidations,
            "--keystore-file",
            keystore_file,
            "--password",
            password,
            "--rpc-file",
            rpc_file,
            "--abi-dir",
            f"{root}/contracts/.build/",
            "--artifacts-dir",
            artifacts_dir,
            str(output),
        )

    assert any("Starting relayer" in msg for msg in caplog.messages)
    assert any("Relayer failed" in msg for msg in caplog.messages)
    assert any("Error(s) occurred during verification" in msg for msg in caplog.messages)
