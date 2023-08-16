import itertools
import json
from itertools import repeat
from pathlib import Path

import ape
import apischema
import pytest

import beamer.check.commands
from beamer.check.commands import Invalidation
from beamer.tests.util import deploy, get_repo_root, run_command, write_keystore_file


def _iter_transactions(w3, from_block, to_block):
    for block_number in range(from_block, to_block + 1):
        block = w3.eth.get_block(block_number)
        yield from block.transactions


@pytest.mark.parametrize("count", (1, 3))
def test_initiate_l1_invalidations(tmp_path, deployer, count):
    password = "test"
    keystore_file = tmp_path / f"{deployer.address}.json"
    write_keystore_file(keystore_file, deployer.private_key, password)

    rpc_file, artifact = deploy(deployer, tmp_path)

    root = get_repo_root()
    output = tmp_path / "invalidations.json"
    chain_id = ape.chain.chain_id
    # We run the command with 2 proof targets: current chain and a dummy chain.
    proof_targets = chain_id, 98765
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
        Path(artifact).parent,
        "--output",
        output,
        "--count",
        count,
        str(chain_id),
        *map(str, proof_targets),
    )
    with output.open("rt") as f:
        data = json.load(f)

    assert len(data) == count * len(proof_targets)
    w3 = ape.chain.provider.web3
    invalidations = apischema.deserialize(list[Invalidation], data)
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


def test_initiate_l1_invalidations_resume(tmp_path, deployer):
    password = "test"
    keystore_file = tmp_path / f"{deployer.address}.json"
    write_keystore_file(keystore_file, deployer.private_key, password)

    rpc_file, artifact = deploy(deployer, tmp_path)

    root = get_repo_root()
    output = tmp_path / "invalidations.json"
    chain_id = ape.chain.chain_id

    def send_invalidations(count, proof_targets):
        block_before = ape.chain.blocks[-1].number
        assert block_before is not None
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
            Path(artifact).parent,
            "--output",
            output,
            "--count",
            count,
            str(chain_id),
            *map(str, proof_targets),
        )
        block_after = ape.chain.blocks[-1].number
        assert block_after is not None

        with output.open("rt") as f:
            data = json.load(f)

        w3 = ape.chain.provider.web3
        invalidations = apischema.deserialize(list[Invalidation], data)
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
