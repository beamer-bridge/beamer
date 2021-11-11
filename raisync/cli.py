import json
import signal
from pathlib import Path

import click
import structlog
from eth_account import Account

import raisync.util
from raisync.node import Config, Node

log = structlog.get_logger(__name__)


def _load_contracts_info(path):
    contracts = {}
    for path in Path(path).glob("*.json"):
        with path.open() as fp:
            info = json.load(fp)
        contracts[info["contractName"]] = info["deployment"]["address"], info["abi"]
    return contracts


def _account_from_keyfile(keyfile, password):
    with open(keyfile, "rt") as fp:
        privkey = Account.decrypt(json.load(fp), password)
    return Account.from_key(privkey)


def _sigint_handler(node):
    signal.signal(signal.SIGINT, signal.SIG_IGN)
    log.info("Received SIGINT, shutting down")
    node.stop()


@click.command()
@click.option(
    "--keystore-file",
    type=str,
    required=True,
    metavar="FILE",
    help="The file that stores the key for the account to be used.",
)
@click.password_option(required=True, help="The password needed to unlock the account.")
@click.option(
    "--l2a-rpc-url",
    type=str,
    required=True,
    metavar="URL",
    help="The URL of the first L2 chain RPC server (e.g. http://10.0.0.2:8545).",
)
@click.option(
    "--l2b-rpc-url",
    type=str,
    required=True,
    metavar="URL",
    help="The URL of the second L2 chain RPC server (e.g. http://10.0.0.3:8545).",
)
@click.option(
    "--contracts-deployment-dir",
    type=str,
    required=True,
    metavar="DIR",
    help="The directory containing contract deployment files.",
)
@click.version_option()
def main(keystore_file, password, l2a_rpc_url, l2b_rpc_url, contracts_deployment_dir):
    raisync.util.setup_logging(log_level="DEBUG", log_json=False)

    account = _account_from_keyfile(keystore_file, password)
    log.info(f"Using account {account.address}")
    contracts_info = _load_contracts_info(contracts_deployment_dir)
    config = Config(
        contracts_info=contracts_info,
        account=account,
        l2a_rpc_url=l2a_rpc_url,
        l2b_rpc_url=l2b_rpc_url,
    )

    signal.signal(signal.SIGINT, lambda *_unused: _sigint_handler(node))
    node = Node(config)
    node.start()
    node.wait()
