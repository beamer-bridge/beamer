import subprocess
from pathlib import Path

import click

import beamer.artifacts
from beamer.config.state import Configuration
from beamer.contracts import ABIManager
from beamer.util import load_rpc_info, make_web3

inactive_agents = [
    "0xa48B6821024ff16884763A21CE149d3412a933E2",
    "0xd065B1B3BD137476CF276351Cf71F44fDE9747eF",
    "0xdC256EC77E97448d29D88118e55C82067150b768",
]


def read_states(rpc_file, abi_dir, artifact_dir: Path, state_dir):
    for artifact in artifact_dir.glob("*-*.deployment.json"):
        command_args = [
            "beamer",
            "config",
            "read",
            "--rpc-file",
            rpc_file,
            "--abi-dir",
            abi_dir,
            "--artifact",
            artifact,
            "--log-level",
            "info",
            f"{state_dir / artifact.name.split('.')[0]}.state",
        ]
        print(f"Read state for {artifact}")
        subprocess.run(command_args)


@click.command()
@click.option(
    "--rpc-file",
    type=click.Path(exists=True, file_okay=True, dir_okay=False, path_type=Path),
    required=True,
    help="Path to the RPC config file.",
)
@click.option(
    "--abi-dir",
    type=click.Path(exists=True, file_okay=False, dir_okay=True, path_type=Path),
    required=True,
    help="Path to the directory with contract ABIs.",
)
@click.option(
    "--artifacts-dir",
    type=click.Path(exists=True, file_okay=False, dir_okay=True, path_type=Path),
    required=True,
    help="Path to the deployment artifact.",
)
@click.option(
    "--state-dir",
    type=click.Path(file_okay=False, dir_okay=True, path_type=Path),
    default="/tmp/state/",
    help="Path to the state files.",
)
def main(rpc_file, abi_dir, artifacts_dir, state_dir):
    read_states(rpc_file, abi_dir, artifacts_dir, state_dir)
    rpc_info = load_rpc_info(rpc_file)
    abi_manager = ABIManager(abi_dir)
    artifacts = [
        beamer.artifacts.Deployment.from_file(artifact_file)
        for artifact_file in artifacts_dir.glob(f"*-*.deployment.json")
    ]

    states = [
        beamer.config.state.Configuration.from_file(state_file)
        for state_file in state_dir.glob(f"*-*.state")
    ]
    print()
    for state in states:
        chain_id = state.chain_id
        print(f"Chain ID: {chain_id}")
        web3 = make_web3(rpc_info[chain_id], None)
        tokens = state.token_addresses

        for symbol, address in tokens.items():
            token = web3.eth.contract(
                address, abi=abi_manager.get_abi("MintableToken"), decode_tuples=True
            )
            decimals = token.functions.decimals().call()
            balances = list()

            for allowed_address in [
                address
                for address in state.fill_manager.whitelist
                if address not in inactive_agents
            ]:
                balances.append(token.functions.balanceOf(allowed_address).call() / 10**decimals)

            print(f"Liquidity: {round(sum(balances),2)} {symbol}")
            print(f"Max transfer: {round(max(balances),2)} {symbol}")
        print()


if __name__ == "__main__":
    main()
