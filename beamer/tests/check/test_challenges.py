import json
import logging
import os
import subprocess
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path

import ape
import apischema
import pytest
from eth_typing import ChecksumAddress
from freezegun import freeze_time

import beamer.check.commands
from beamer.artifacts import Deployment
from beamer.check.commands import Challenge
from beamer.tests.util import (
    CommandFailed,
    alloc_accounts,
    deploy,
    get_repo_root,
    run_command,
    write_keystore_file,
)


@dataclass
class _Context:
    challenger: ChecksumAddress
    challenger_keystore_file: Path
    deployment: Deployment
    artifacts_dir: Path
    rpc_file: Path


def _initiate(ctx, output, *chain_ids):
    root = get_repo_root()
    run_command(
        beamer.check.commands.initiate_challenges,
        "--keystore-file",
        ctx.challenger_keystore_file,
        "--password",
        "test",
        "--rpc-file",
        ctx.rpc_file,
        "--abi-dir",
        f"{root}/contracts/.build/",
        "--artifacts-dir",
        ctx.artifacts_dir,
        "--token",
        "TST",
        "--output",
        output,
        *map(str, chain_ids),
    )


def _verify(ctx, output):
    root = get_repo_root()
    run_command(
        beamer.check.commands.verify_challenges,
        "--rpc-file",
        ctx.rpc_file,
        "--abi-dir",
        f"{root}/contracts/.build/",
        "--artifacts-dir",
        ctx.artifacts_dir,
        str(output),
    )


def _start_agent(ctx, tmp_path, account):
    password = "test"
    keystore_file = tmp_path / f"{account.address}.json"
    write_keystore_file(keystore_file, account.private_key, password)

    deployment_base = beamer.artifacts.load_base(ctx.artifacts_dir)
    assert deployment_base.base is not None

    chain_id = ape.chain.chain_id
    with open(ctx.rpc_file, "rt") as f:
        rpc_url = json.load(f)[str(chain_id)]

    root = get_repo_root()
    env = os.environ.copy()
    env["RESOLVER"] = deployment_base.base.contracts["Resolver"].address
    env["ETHEREUM_L2_MESSENGER"] = ctx.deployment.chain.contracts["EthereumL2Messenger"].address
    env["BEAMER_ALLOW_UNLISTED_PAIRS"] = "1"
    token_address = ctx.deployment.chain.contracts["MintableToken"].address

    config = f"""
    log-level = "debug"
    abi-dir = "{root}/contracts/.build/"
    artifacts-dir = "{str(ctx.artifacts_dir)}"
    fill-wait-time = 0
    confirmation-blocks = 0

    [account]
    path = "{str(keystore_file)}"
    password = "{password}"

    [base-chain]
    rpc-url = "{rpc_url}"

    [chains.local]
    rpc-url = "{rpc_url}"

    [tokens]
    TST = [
        ["{str(chain_id)}", "{token_address}", "-1"]
    ]
    """

    config_path = tmp_path / "agent.conf"
    config_path.write_text(config)
    return subprocess.Popen(
        ["beamer", "agent", "--config", str(config_path)], env=env, stdout=subprocess.PIPE
    )


def _prepare(tmp_path, deployer):
    (challenger,) = alloc_accounts(1)
    password = "test"
    challenger_keystore_file = tmp_path / f"{challenger.address}.json"
    write_keystore_file(challenger_keystore_file, challenger.private_key, password)

    rpc_file, artifact = deploy(deployer, tmp_path)
    artifacts_dir = Path(artifact).parent

    chain_id = ape.chain.chain_id

    deployment = Deployment.from_file(artifact)
    assert deployment.chain is not None
    request_manager = ape.project.RequestManager.at(
        deployment.chain.contracts["RequestManager"].address
    )
    token = ape.project.MintableToken.at(deployment.chain.contracts["MintableToken"].address)
    token.mint(challenger, 200)
    request_manager.updateToken(token.address, 1, 2)
    request_manager.updateChain(chain_id, 1, 2, 3)
    request_manager.addAllowedLp(deployer.address)
    fill_manager = ape.project.FillManager.at(deployment.chain.contracts["FillManager"].address)
    fill_manager.addAllowedLp(deployer.address)
    return _Context(
        challenger=challenger,
        challenger_keystore_file=challenger_keystore_file,
        deployment=deployment,
        artifacts_dir=artifacts_dir,
        rpc_file=rpc_file,
    )


def test_initiate_challenges(tmp_path, deployer, caplog):
    ctx = _prepare(tmp_path, deployer)
    proc = _start_agent(ctx, tmp_path, deployer)

    output = tmp_path / "challenges.json"
    caplog.clear()
    caplog.set_level(logging.INFO)
    _initiate(ctx, output, ape.chain.chain_id, ape.chain.chain_id)
    assert any("All challenges initiated succesfully" in msg for msg in caplog.messages)
    proc.kill()

    with output.open("rt") as f:
        data = json.load(f)

    challenges = apischema.deserialize(list[Challenge], data)
    assert len(challenges) == 1

    challenge = challenges[0]
    assert challenge.finalization_timestamp is not None
    assert challenge.challenge_claim_txhash is not None
    transaction = ape.chain.provider.web3.eth.get_transaction(challenge.challenge_claim_txhash)
    assert transaction["from"] == ctx.challenger.address

    # Make sure the next run does not do anything, since the challenges have already been issued.
    caplog.clear()
    block_before = ape.chain.blocks[-1].number
    _initiate(ctx, output, ape.chain.chain_id, ape.chain.chain_id)
    assert ape.chain.blocks[-1].number == block_before
    assert any("All challenges initiated succesfully" in msg for msg in caplog.messages)


def test_initiate_missing_token(tmp_path, deployer, caplog):
    (challenger,) = alloc_accounts(1)
    password = "test"
    keystore_file = tmp_path / f"{challenger.address}.json"
    write_keystore_file(keystore_file, challenger.private_key, password)

    chain_id = ape.chain.chain_id
    rpc_file, artifact = deploy(deployer, tmp_path)
    artifacts_dir = Path(artifact).parent
    root = get_repo_root()
    caplog.clear()
    with pytest.raises(CommandFailed):
        run_command(
            beamer.check.commands.initiate_challenges,
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
            "--token",
            "MISSING_TOKEN",
            "--output",
            str(tmp_path / "challenges.json"),
            str(chain_id),
            str(chain_id),
        )
    assert any("Could not find token" in msg for msg in caplog.messages)


def test_verify_challenges(tmp_path, deployer, caplog):
    ctx = _prepare(tmp_path, deployer)
    proc = _start_agent(ctx, tmp_path, deployer)

    output = tmp_path / "challenges.json"
    _initiate(ctx, output, ape.chain.chain_id, ape.chain.chain_id)

    with output.open("rt") as f:
        data = json.load(f)

    challenges = apischema.deserialize(list[Challenge], data)
    request_id = challenges[0].request_id.hex()

    while line := proc.stdout.readline():
        line = line.decode("utf-8")
        if "state=withdrawn" in line and request_id in line:
            break
    proc.kill()

    caplog.clear()
    caplog.set_level(logging.INFO)
    _verify(ctx, output)
    assert any("All challenges verified successfully" in msg for msg in caplog.messages)


def test_verify_challenges_not_finalized(tmp_path, deployer, caplog):
    ctx = _prepare(tmp_path, deployer)
    proc = _start_agent(ctx, tmp_path, deployer)

    output = tmp_path / "challenges.json"
    _initiate(ctx, output, ape.chain.chain_id, ape.chain.chain_id)
    proc.send_signal(9)

    caplog.clear()
    caplog.set_level(logging.INFO)
    with pytest.raises(CommandFailed):
        with freeze_time(datetime.utcnow() - timedelta(minutes=10)):
            _verify(ctx, output)
    assert any("Challenge not yet finalized, skipping" in msg for msg in caplog.messages)
    assert any("Failed to verify all challenges" in msg for msg in caplog.messages)
