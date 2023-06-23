import json
import pathlib
import tempfile

import eth_account
from click.testing import CliRunner

import beamer.deploy.commands
from beamer.config.state import Configuration

from beamer.tests.util import get_repo_root


class CommandFailed(Exception):
    pass


def run(*args):
    runner = CliRunner()
    result = runner.invoke(*args)
    if result.exit_code:
        raise CommandFailed(result)


def write_keystore_file(path, private_key, password):
    obj = eth_account.Account.encrypt(private_key, password)
    path.write_text(json.dumps(obj))


def read_config_state(rpc_file, artifact):
    root = get_repo_root()
    with tempfile.TemporaryDirectory() as tmp_path:
        state_path = pathlib.Path(tmp_path) / "config.state"
        run(
            beamer.config.commands.read,
            (
                "--rpc-file",
                rpc_file,
                "--abi-dir",
                f"{root}/contracts/.build/",
                "--artifact",
                artifact,
                str(state_path),
            ),
        )
        return Configuration.from_file(state_path)


def deploy(deployer, destdir):
    password = "test"
    keystore_file = destdir / f"{deployer.address}.json"
    write_keystore_file(keystore_file, deployer.private_key, password)
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

    root = get_repo_root()
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
            "--deploy-mintable-token",
            f"{root}/deployments/config/local/1337-ethereum.json",
        ),
    )

    artifact = f"{artifacts_dir}/1337-ethereum.deployment.json"
    return rpc_file, artifact
