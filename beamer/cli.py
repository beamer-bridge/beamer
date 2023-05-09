import click

from beamer.agent import commands as agent_commands
from beamer.deploy import commands as deploy_commands
from beamer.health import commands as health_commands


@click.group()
def main() -> None:
    pass


main.add_command(agent_commands.agent)
main.add_command(health_commands.monitor)
main.add_command(deploy_commands.deploy)
main.add_command(deploy_commands.deploy_base)
