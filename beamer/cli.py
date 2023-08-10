import click

from beamer.agent import commands as agent_commands
from beamer.check import commands as check_commands
from beamer.config import commands as config_commands
from beamer.deploy import commands as deploy_commands
from beamer.health import commands as health_commands


@click.group()
def main() -> None:
    pass


main.add_command(agent_commands.agent)
main.add_command(health_commands.monitor)
main.add_command(deploy_commands.deploy)
main.add_command(deploy_commands.deploy_base)
main.add_command(config_commands.config)
main.add_command(check_commands.check)
