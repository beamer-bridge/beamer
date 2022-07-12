import signal
import sys
from importlib.metadata import version
from pathlib import Path
from typing import Optional

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

    default_fill_wait_time = 120
    default_log_level = "info"

    raw_config = dict()

    if config_file_path is not None:
        raw_config = toml.load(config_file_path)

    log_level = log_level or raw_config.get("log-level") or default_log_level
    beamer.util.setup_logging(log_level=log_level.upper(), log_json=False)

    log.info("Running beamer bridge agent", version=version("beamer"))

    fill_wait_time = fill_wait_time or raw_config.get("fill-wait-time") or default_fill_wait_time

    l1_rpc_url=l1_rpc_url or raw_config.get("chains", {}).get("l1", {}).get("rpc-url")
    l2a_rpc_url=l2a_rpc_url or raw_config.get("chains", {}).get("l2a", {}).get("rpc-url")
    l2b_rpc_url=l2b_rpc_url or raw_config.get("chains", {}).get("l2b", {}).get("rpc-url")
    deployment_dir = deployment_dir or raw_config.get("deployment-dir")
    account_path = keystore_file or raw_config.get("account", {}).get("path")
    password = password or raw_config.get("account", {}).get("password")

    if l1_rpc_url is None:
        raise click.UsageError("Provide l1 rpc url either via config file or argument.")
    if l2a_rpc_url is None:
        raise click.UsageError("Provide l2a rpc url either via config file or argument.")
    if l2b_rpc_url is None:
        raise click.UsageError("Provide l2b rpc url either via config file or argument.")
    if deployment_dir is None:
        raise click.UsageError("Provide deployment directory either via config file or argument.")
    if account_path is None:
        raise click.UsageError("Provide account keystore path either via config file or argument.")

    if password is None:
        password = click.prompt(
            "The password needed to unlock the account",
            type=str,
            hide_input=True,
            confirmation_prompt=True,
        )

    account = account_from_keyfile(account_path, password)
    log.info(f"Using account {account.address}")

    deployment_info = beamer.contracts.load_deployment_info(Path(deployment_dir))

    if token_match_file is not None:
        with open(token_match_file, "r") as f:
            match_checker = TokenMatchChecker.from_file(f)
    else:
        match_checker = TokenMatchChecker(raw_config.get("tokens").values())

    config = Config(
        account=account,
        deployment_info=deployment_info,
        l1_rpc_url=l1_rpc_url or raw_config.get("chains").get("l1").get("rpc-url"),
        l2a_rpc_url=l2a_rpc_url or raw_config.get("chains").get("l2a").get("rpc-url"),
        l2b_rpc_url=l2b_rpc_url or raw_config.get("chains").get("l2b").get("rpc-url"),
        token_match_checker=match_checker,
        fill_wait_time=fill_wait_time,
        prometheus_metrics_port=prometheus_metrics_port,
    )

    if not get_relayer_executable().exists():
        log.error("No relayer found")
        sys.exit(1)

    signal.signal(signal.SIGINT, lambda *_unused: _sigint_handler(agent))
    agent = Agent(config)
    agent.start()
    agent.wait()
