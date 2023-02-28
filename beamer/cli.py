import click

from beamer.agent import commands as agent_commands
from beamer.health import commands as health_commands


@click.group()
def main() -> None:
    pass


main.add_command(agent_commands.agent)
main.add_command(health_commands.monitor)
