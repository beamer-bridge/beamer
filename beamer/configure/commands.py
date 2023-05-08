from dataclasses import dataclass, field
from pathlib import Path
from typing import NamedTuple

import click
from eth_account.signers.local import LocalAccount
from web3 import Web3
from web3.contract import Contract, ContractConstructor
from web3.contract.contract import ContractFunction
from web3.types import ABI

from beamer.agent.contracts import DeploymentInfo, load_deployment_info, make_contracts
from beamer.agent.events import camel_to_snake
from beamer.agent.typing import ChainId
from beamer.agent.util import TransactionFailed, account_from_keyfile, make_web3, transact
from beamer.configure.config import ChainConfig, Command, Config


@dataclass
class _Chain:
    name: str
    web3: Web3
    contracts: dict[str, Contract] = field(default_factory=dict)
    tokens: list[list[str]] = field(default_factory=list)

    @staticmethod
    def from_config(
        chain_id: str,
        chain_config: ChainConfig,
        account: LocalAccount,
        deployment_info: DeploymentInfo,
    ) -> "_Chain":
        web3 = make_web3(chain_config.rpc, account)
        rpc_chain_id = ChainId(web3.eth.chain_id)
        assert ChainId(int(chain_id)) == rpc_chain_id
        contracts = make_contracts(web3, deployment_info[rpc_chain_id])
        return _Chain(chain_config.name, web3, contracts, chain_config.tokens)

    def get_token_address(self, symbol: str) -> str | None:
        for token, address in self.tokens:
            if symbol == token:
                return address
        return None


def _transact(transaction: ContractConstructor | ContractFunction) -> None:
    try:
        receipt = transact(transaction)
        if receipt is not None and receipt.status != 0:
            print(f"Transaction successfully executed! Hash: {receipt.transactionHash.hex()}")
        else:
            print("Transaction failed!")
    except TransactionFailed:
        print("Transaction failed!")


def _get_inputs_for_field(abi: ABI, name: str) -> list[str]:
    for contract_field in abi:
        if contract_field.get("name") == name:
            return [arg["name"] for arg in contract_field["inputs"]]
    raise ValueError("Field not in ABI")


def _get_values_from_mapping(contract: Contract, command: str, key: str | int) -> NamedTuple:
    subject = "%ss" % command.removeprefix("update").lower()
    read_func = getattr(contract.functions, subject)
    return read_func(key).call()


def _merge_values(
    input_names: list[str], current_values: NamedTuple, new_values: dict[str, str | int]
) -> tuple[str | int, ...]:
    values: list[str | int] = list()
    for name in input_names:
        values.append(new_values.get(camel_to_snake(name), getattr(current_values, name)))
    return tuple(values)


def _execute_command(chain: _Chain, command: Command) -> None:
    for param in command.params:
        key = param.key
        if command.name == "updateToken":
            key = chain.get_token_address(str(param.key))

        request_manager = chain.contracts["RequestManager"]
        # FIXME: new commands do not necessarily need a key -> updateFees
        assert key is not None
        current_values = _get_values_from_mapping(request_manager, command.name, key)
        input_names = _get_inputs_for_field(request_manager.abi, command.name)[1:]
        write_params = _merge_values(input_names, current_values, param.values)

        if write_params == current_values:
            print("Values already configured. Not executing!")
            return

        write_func = getattr(chain.contracts["RequestManager"].functions, command.name)
        _transact(write_func(key, *write_params))


def _execute_on_chain(chain: _Chain, commands: list[Command]) -> None:
    for command in commands:
        print(f"Execute {command.name}...")
        _execute_command(chain, command)


def _make_chains(
    chain_configs: dict[str, ChainConfig], account: LocalAccount, deployment_dir: str
) -> dict[ChainId, _Chain]:
    deployment_info = load_deployment_info(Path(deployment_dir))
    return {
        ChainId(int(chain_id)): _Chain.from_config(chain_id, chain, account, deployment_info)
        for chain_id, chain in chain_configs.items()
    }


@click.command("configure")
@click.option(
    "--keystore-file",
    type=click.Path(exists=True, file_okay=True, dir_okay=False, path_type=Path),
    required=True,
    metavar="FILE",
    help="The file that stores the key for the account to be used.",
)
@click.option(
    "--password", type=str, required=True, help="The password needed to unlock the account."
)
@click.option(
    "--config-file",
    type=click.Path(exists=True, file_okay=True, dir_okay=False, path_type=Path),
    required=True,
    metavar="FILE",
    help="The file containing configuration information.",
)
def configure(keystore_file: Path, password: str, config_file: Path) -> None:
    account = account_from_keyfile(keystore_file, password)
    config = Config.from_file(config_file)
    chains = _make_chains(config.chains, account, config.deployment_dir)
    for chain in chains.values():
        print(f"Chain: {chain.name}...")
        _execute_on_chain(chain, config.commands)
