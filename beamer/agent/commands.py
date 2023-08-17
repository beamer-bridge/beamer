import signal
import sys
from importlib.metadata import version
from pathlib import Path
from typing import Optional

import click
import structlog

import beamer.agent.config
import beamer.contracts
import beamer.util
from beamer.agent.agent import Agent
from beamer.relayer import get_relayer_executable

log = structlog.get_logger(__name__)


def _sigint_handler(agent: Agent) -> None:
    signal.signal(signal.SIGINT, signal.SIG_IGN)
    log.info("Received SIGINT, shutting down")
    agent.stop()


@click.command("agent", help="Run the agent.")
@click.option(
    "--config",
    "-c",
    "config_path",
    type=click.Path(exists=True, file_okay=True, dir_okay=False, path_type=Path),
    metavar="PATH",
    help="Path to the agent's config file.",
)
@click.option(
    "--account-path",
    type=click.Path(exists=True, file_okay=True, dir_okay=False, path_type=Path),
    metavar="PATH",
    help="Path to the account keyfile.",
)
@click.password_option(
    "--account-password", type=str, prompt=False, help="The password needed to unlock the account."
)
@click.option(
    "--artifacts-dir",
    type=click.Path(exists=True, file_okay=False, dir_okay=True, path_type=Path),
    metavar="DIR",
    help="The directory containing deployment artifact files.",
)
@click.option(
    "--abi-dir",
    type=click.Path(exists=True, file_okay=False, dir_okay=True, path_type=Path),
    metavar="DIR",
    help="The directory containing contract abi files.",
)
@click.option(
    "--fill-wait-time",
    type=int,
    help="Time in seconds to wait for a fill event before challenging a false claim.",
)
@click.option(
    "--unsafe-fill-time",
    type=int,
    help="""Time in seconds before request expiry, during which the agent will consider it
    unsafe to fill and ignore the request.""",
)
@click.option(
    "--poll-period",
    type=float,
    help="""Time in seconds which is waited before new events are fetched from the chains after
    the last fetch. Default: 5.0""",
)
@click.option(
    "--confirmation-blocks",
    type=int,
    help="""Number of blocks to wait before processing a block""",
)
@click.option(
    "--log-level",
    type=click.Choice(("debug", "info", "warning", "error", "critical")),
    help="The log level. Default: info",
)
@click.option(
    "--metrics-prometheus-port",
    type=int,
    default=None,
    metavar="PORT",
    show_default=True,
    help="Provide Prometheus metrics on PORT.",
)
@click.option(
    "--base-chain",
    type=str,
    help="Associate a JSON-RPC endpoint URL with base chain. Example: http://foo.bar:8545.",
)
@click.option(
    "--chain",
    type=str,
    multiple=True,
    metavar="NAME=URL",
    help="Associate a JSON-RPC endpoint URL with chain NAME. Example: foo=http://foo.bar:8545.",
)
@click.option(
    "--source-chain", type=str, metavar="NAME", help="Name of the source chain. (deprecated)"
)
@click.option(
    "--target-chain", type=str, metavar="NAME", help="Name of the target chain. (deprecated)"
)
@click.version_option()
def agent(
    config_path: Path,
    account_path: Optional[Path],
    account_password: Optional[str],
    artifacts_dir: Optional[Path],
    abi_dir: Optional[Path],
    fill_wait_time: Optional[int],
    log_level: Optional[str],
    base_chain: str,
    chain: tuple[str],
    source_chain: Optional[str],
    target_chain: Optional[str],
    metrics_prometheus_port: Optional[int],
    unsafe_fill_time: Optional[int],
    poll_period: Optional[float],
    confirmation_blocks: Optional[int],
) -> None:
    """Start Beamer Bridge Agent"""

    if source_chain is not None:
        log.warning("Option --source-chain is deprecated and will be removed")
    if target_chain is not None:
        log.warning("Option --target_chain is deprecated and will be removed")

    options = {
        "fill-wait-time": fill_wait_time,
        "log-level": log_level,
        "artifacts-dir": artifacts_dir,
        "abi-dir": abi_dir,
        "metrics.prometheus-port": metrics_prometheus_port,
        "source-chain": source_chain,
        "target-chain": target_chain,
        "account.path": account_path,
        "account.password": account_password,
        "unsafe-fill-time": unsafe_fill_time,
        "poll-period": poll_period,
        "base-chain.rpc-url": base_chain,
        "confirmation-blocks": confirmation_blocks,
    }

    for chainspec in chain:
        name, rpc_url = chainspec.split("=", 1)
        options[f"chains.{name}.rpc-url"] = rpc_url

    config = beamer.agent.config.load(config_path, options)

    beamer.util.setup_logging(log_level=config.log_level.upper(), log_json=False)
    log.info("Running beamer bridge agent", version=version("beamer"))
    log.info(f"Using account {config.account.address}")

    if not get_relayer_executable().exists():
        log.error("No relayer found")
        sys.exit(1)

    agent = Agent(config)
    signal.signal(signal.SIGINT, lambda *_unused: _sigint_handler(agent))
    agent.start()
    agent.wait()
