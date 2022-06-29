import signal
import sys
from pathlib import Path
from typing import Optional

import click
import structlog

import beamer.contracts
import beamer.util
from beamer.agent import Agent
from beamer.config import Config
from beamer.l1_resolution import get_relayer_executable
from beamer.typing import URL
from beamer.util import account_from_keyfile

log = structlog.get_logger(__name__)


def _sigint_handler(agent: Agent) -> None:
    signal.signal(signal.SIGINT, signal.SIG_IGN)
    log.info("Received SIGINT, shutting down")
    agent.stop()


@click.command()
@click.option(
    "--keystore-file",
    type=click.Path(exists=True, file_okay=True, dir_okay=False, path_type=Path),
    required=True,
    metavar="FILE",
    help="The file that stores the key for the account to be used.",
)
@click.password_option(required=True, help="The password needed to unlock the account.")
@click.option(
    "--l1-rpc-url",
    type=str,
    required=True,
    metavar="URL",
    help="The URL of the L1 chain RPC server (e.g. http://10.0.0.3:8545).",
)
@click.option(
    "--l2a-rpc-url",
    type=str,
    required=True,
    metavar="URL",
    help="The URL of the source L2 chain RPC server (e.g. http://10.0.0.2:8545).",
)
@click.option(
    "--l2b-rpc-url",
    type=str,
    required=True,
    metavar="URL",
    help="The URL of the target L2 chain RPC server (e.g. http://10.0.0.3:8545).",
)
@click.option(
    "--deployment-dir",
    type=click.Path(exists=True, file_okay=False, dir_okay=True, path_type=Path),
    required=True,
    metavar="DIR",
    help="The directory containing contract deployment files.",
)
@click.option(
    "--token-match-file",
    type=click.Path(exists=True, file_okay=True, dir_okay=False, path_type=Path),
    required=True,
    metavar="FILE",
    help="The file containing token matching information.",
)
@click.option(
    "--fill-wait-time",
    type=int,
    default=120,
    help="Time in seconds to wait for a fill event before challenging a false claim.",
)
@click.option(
    "--log-level",
    type=click.Choice(("debug", "info", "warning", "error", "critical")),
    default="info",
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
@click.version_option()
def main(
    keystore_file: Path,
    password: str,
    l1_rpc_url: URL,
    l2a_rpc_url: URL,
    l2b_rpc_url: URL,
    deployment_dir: Path,
    token_match_file: Path,
    fill_wait_time: int,
    log_level: str,
    prometheus_metrics_port: Optional[int],
) -> None:
    beamer.util.setup_logging(log_level=log_level.upper(), log_json=False)

    if get_relayer_executable() is None:
        log.error("No relayer found")
        sys.exit(1)

    account = account_from_keyfile(keystore_file, password)
    log.info(f"Using account {account.address}")
    deployment_info = beamer.contracts.load_deployment_info(deployment_dir)
    config = Config(
        account=account,
        deployment_info=deployment_info,
        l1_rpc_url=l1_rpc_url,
        l2a_rpc_url=l2a_rpc_url,
        l2b_rpc_url=l2b_rpc_url,
        token_match_file=token_match_file,
        fill_wait_time=fill_wait_time,
        prometheus_metrics_port=prometheus_metrics_port,
    )

    signal.signal(signal.SIGINT, lambda *_unused: _sigint_handler(agent))
    agent = Agent(config)
    agent.start()
    agent.wait()
