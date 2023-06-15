import json
import pathlib

import eth_account
from click.testing import CliRunner

import beamer.deploy.commands


def run(*args):
    runner = CliRunner()
    result = runner.invoke(*args)
    assert result.exit_code == 0


def _write_keystore_file(path, private_key, password):
    obj = eth_account.Account.encrypt(private_key, password)
    path.write_text(json.dumps(obj))


def deploy(deployer, destdir):
    password = "test"
    keystore_file = destdir / f"{deployer.address}.json"
    _write_keystore_file(keystore_file, deployer.private_key, password)
    artifacts_dir = destdir / "artifacts"
    artifacts_dir.mkdir()

    rpc_file = destdir / "rpc.json"
    rpc_file.write_text(json.dumps({"1337": "http://localhost:8545"}))

    run(
        beamer.deploy.commands.deploy_base,
        (
            "--rpc-file",
            rpc_file,
            "--keystore-file",
            keystore_file,
            "--password",
            password,
            "--artifacts-dir",
            artifacts_dir,
            "--commit-check",
            "no",
            "1337",
        ),
    )

    root = pathlib.Path(__file__).parents[3]
    run(
        beamer.deploy.commands.deploy,
        (
            "--rpc-file",
            rpc_file,
            "--keystore-file",
            keystore_file,
            "--password",
            password,
            "--artifacts-dir",
            artifacts_dir,
            "--commit-check",
            "no",
            f"{root}/deployments/config/local/1337-ethereum.json",
        ),
    )

    artifact = f"{artifacts_dir}/1337-ethereum.deployment.json"
    return rpc_file, artifact
