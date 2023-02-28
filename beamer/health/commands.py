from pathlib import Path

import click

from beamer.agent.util import setup_logging
from beamer.health.check import main


@click.command("health-check", help="Analyzes the beamer protocol and agent activity.")
@click.option(
    "--config",
    "-c",
    "config_path",
    type=click.Path(exists=True, file_okay=True, dir_okay=False, path_type=Path),
    metavar="PATH",
    help="Config file with chains configuration",
)
@click.option(
    "--log-level",
    type=click.Choice(("debug", "info", "warning", "error", "critical")),
    help="The log level. Default: error",
    default="error",
)
def monitor(
    config_path: Path,
    log_level: str,
) -> None:
    """Beamer Health Check

    Beamer Health Check is a tool for analyzing the beamer protocol and agent activity.

    """

    setup_logging(log_level=log_level.upper(), log_json=False)

    main(config_path)
