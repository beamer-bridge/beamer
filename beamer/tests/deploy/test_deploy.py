import json

import ape

import beamer.deploy.commands
from beamer.artifacts import Deployment
from beamer.tests.util import get_repo_root, run_command, write_keystore_file
from beamer.util import get_commit_id


def test_deploy(deployer, tmp_path):
    password = "test"
    keystore_file = tmp_path / f"{deployer.address}.json"
    write_keystore_file(keystore_file, deployer.private_key, password)
    artifacts_dir = tmp_path / "artifacts"
    artifacts_dir.mkdir()

    chain_id = ape.chain.chain_id
    rpc_file = tmp_path / "rpc.json"
    rpc_file.write_text(json.dumps({f"{chain_id}": "http://localhost:8545"}))

    root = get_repo_root()
    run_command(
        beamer.deploy.commands.deploy_base,
        "--rpc-file",
        rpc_file,
        "--keystore-file",
        keystore_file,
        "--password",
        password,
        "--abi-dir",
        f"{root}/contracts/.build/",
        "--artifacts-dir",
        artifacts_dir,
        "--commit-check",
        "no",
        f"{chain_id}",
    )

    artifact = artifacts_dir / "base.deployment.json"
    deployment = Deployment.from_file(artifact)
    assert deployment.chain is None
    assert deployment.deployer == deployer.address
    assert deployment.base is not None
    assert deployment.base.chain_id == chain_id
    assert tuple(deployment.base.contracts) == ("Resolver",)
    info = deployment.base.contracts["Resolver"]
    assert info.beamer_commit == get_commit_id()

    block_number = ape.chain.blocks[-1].number
    assert block_number is not None

    run_command(
        beamer.deploy.commands.deploy,
        "--rpc-file",
        rpc_file,
        "--keystore-file",
        keystore_file,
        "--password",
        password,
        "--abi-dir",
        f"{root}/contracts/.build/",
        "--artifacts-dir",
        artifacts_dir,
        "--commit-check",
        "no",
        "--deploy-mintable-token",
        f"{root}/deployments/config/local/{chain_id}-ethereum.json",
    )

    artifact = artifacts_dir / f"{chain_id}-ethereum.deployment.json"
    deployment = Deployment.from_file(artifact)
    assert deployment.chain is not None
    assert deployment.deployer == deployer.address
    assert deployment.base is not None
    assert deployment.base.chain_id == chain_id
    assert deployment.chain.chain_id == chain_id
    assert tuple(deployment.base.contracts) == ("EthereumL1Messenger",)
    assert frozenset(deployment.chain.contracts) == {
        "MintableToken",
        "EthereumL2Messenger",
        "FillManager",
        "RequestManager",
    }
    assert deployment.earliest_block >= block_number
