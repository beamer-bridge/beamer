import json
import signal
import sys
from importlib.metadata import version
from pathlib import Path
from typing import Optional, Any

import click
import structlog
import toml
from eth_utils import to_checksum_address

import beamer.contracts
import beamer.util
from beamer.agent import Agent
from beamer.config import Config
from beamer.l1_resolution import get_relayer_executable
from beamer.typing import URL, ChainId
from beamer.util import account_from_keyfile, TokenMatchChecker

log = structlog.get_logger(__name__)


def _sigint_handler(agent: Agent) -> None:
    signal.signal(signal.SIGINT, signal.SIG_IGN)
    log.info("Received SIGINT, shutting down")
    agent.stop()


@click.command()
@click.option(
    "--keystore-file",
    type=click.Path(exists=True, file_okay=True, dir_okay=False, path_type=Path),
    metavar="FILE",
    help="The file that stores the key for the account to be used.",
)
@click.option(
    "--l1-rpc-url",
    type=str,
    metavar="URL",
    help="The URL of the L1 chain RPC server (e.g. http://10.0.0.3:8545).",
)
@click.option(
    "--l2a-rpc-url",
    type=str,
    metavar="URL",
    help="The URL of the source L2 chain RPC server (e.g. http://10.0.0.2:8545).",
)
@click.option(
    "--l2b-rpc-url",
    type=str,
    metavar="URL",
    help="The URL of the target L2 chain RPC server (e.g. http://10.0.0.3:8545).",
)
@click.option(
    "--deployment-dir",
    type=click.Path(exists=True, file_okay=False, dir_okay=True, path_type=Path),
    metavar="DIR",
    help="The directory containing contract deployment files.",
)
@click.option(
    "--token-match-file",
    type=click.Path(exists=True, file_okay=True, dir_okay=False, path_type=Path),
    metavar="FILE",
    help="The file containing token matching information.",
)
@click.option(
    "--fill-wait-time",
    type=int,
    help="Time in seconds to wait for a fill event before challenging a false claim.",
)
@click.option(
    "--log-level",
    type=click.Choice(("debug", "info", "warning", "error", "critical")),
    show_default=True,
    help="The log level.",
)
@click.option(
    "--prometheus-metrics-port",
    type=int,
    default=None,
    metavar="PORT",
    show_default=True,
    help="Provide Prometheus metrics on PORT.",
)
@click.option(
    "--config",
    "-c",
    "config_file_path",
    type=click.Path(exists=True, file_okay=True, dir_okay=False, path_type=Path),
    default=None,
    metavar="FILE",
    help="Config file for the agent.",
)
@click.password_option(required=False, prompt=False, help="The password needed to unlock the account.")
@click.version_option()
def main(
    keystore_file: Optional[Path],
    l1_rpc_url: Optional[URL],
    l2a_rpc_url: Optional[URL],
    l2b_rpc_url: Optional[URL],
    deployment_dir: Optional[Path],
    token_match_file: Optional[Path],
    fill_wait_time: Optional[int],
    log_level: Optional[str],
    prometheus_metrics_port: Optional[int],
    config_file_path: Optional[Path],
    password: Optional[str]
) -> None:

    raw_config: dict[str, Any] = dict()
    raw_config["fill-wait-time"] = 120
    raw_config["log-level"] = "info"
    raw_config["prometheus-port"] = None

    if config_file_path is not None:
        loaded_toml = toml.load(config_file_path)

        if (l2a_rpc_url is None or token_match_file is None) and "source-chain" not in loaded_toml.keys():
            raise click.UsageError(f"Missing key source-chain in config file.")
        if (l2b_rpc_url is None or token_match_file is None) and "target-chain" not in loaded_toml.keys():
            raise click.UsageError(f"Missing key target-chain in config file.")

        l2a_chain_name = loaded_toml.get("source-chain", "")
        l2b_chain_name = loaded_toml.get("target-chain", "")

        file_config = {
            "fill-wait-time": loaded_toml.get("fill-wait-time"),
            "log-level": loaded_toml.get("log-level"),
            "prometheus-port": loaded_toml.get("metrics", {}).get("prometheus-port"),
            "l1-rpc-url": loaded_toml.get("chains", {}).get("l1", {}).get("rpc-url"),
            "l2a-rpc-url": loaded_toml.get("chains", {}).get(l2a_chain_name, {}).get("rpc-url"),
            "l2b-rpc-url": loaded_toml.get("chains", {}).get(l2b_chain_name, {}).get("rpc-url"),
            "deployment-dir": loaded_toml.get("deployment-dir"),
            "account-path": loaded_toml.get("account", {}).get("path"),
            "account-password": loaded_toml.get("account", {}).get("password"),
            "tokens": loaded_toml.get("tokens", {}).values()
        }
        raw_config.update({k: v for k,v in file_config.items() if v is not None})

    argument_config = {
        "fill-wait-time": fill_wait_time,
        "log-level": log_level,
        "prometheus-port": prometheus_metrics_port,
        "l1-rpc-url": l1_rpc_url,
        "l2a-rpc-url": l2a_rpc_url,
        "l2b-rpc-url": l2b_rpc_url,
        "deployment-dir": deployment_dir,
        "account-path": keystore_file,
        "account-password": password,
    }
    if token_match_file is not None:
        with open(token_match_file, "r") as f:
            argument_config["tokens"] = json.load(f)
    raw_config.update({k: v for k,v in argument_config.items() if v is not None})

    beamer.util.setup_logging(log_level=raw_config["log-level"].upper(), log_json=False)
    log.info("Running beamer bridge agent", version=version("beamer"))

    if raw_config["account-password"] is None:
        raw_config["account-password"] = click.prompt(
            "The password needed to unlock the account",
            type=str,
            hide_input=True,
            confirmation_prompt=True,
        )

    for key in argument_config.keys():
        if key not in raw_config.keys():
            raise click.UsageError(f"Provide {key} either via config file or argument.")

    account = account_from_keyfile(raw_config["account-path"], raw_config["account-password"])
    log.info(f"Using account {account.address}")

    deployment_info = beamer.contracts.load_deployment_info(Path(raw_config["deployment-dir"]))

    config = Config(
        account=account,
        deployment_info=deployment_info,
        l1_rpc_url=raw_config["l1-rpc-url"],
        l2a_rpc_url=raw_config["l2a-rpc-url"],
        l2b_rpc_url=raw_config["l2b-rpc-url"],
        token_match_checker=TokenMatchChecker(raw_config["tokens"]),
        fill_wait_time=raw_config["fill-wait-time"],
        prometheus_metrics_port=raw_config.get("prometheus-port"),
    )

    if not get_relayer_executable().exists():
        log.error("No relayer found")
        sys.exit(1)

    signal.signal(signal.SIGINT, lambda *_unused: _sigint_handler(agent))
    agent = Agent(config)
    agent.start()
    agent.wait()
