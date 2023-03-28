import json
import shutil
import subprocess
from pathlib import Path
from typing import Any, Sequence, Union, cast

import click
from config import Chain, Config, ConfigValidationError
from eth_account.signers.local import LocalAccount
from eth_utils import encode_hex, to_wei
from web3 import Web3
from web3.contract import Contract
from web3.gas_strategies.rpc import rpc_gas_price_strategy
from web3.types import TxParams, Wei

from beamer.agent.util import account_from_keyfile, make_web3, transact

GANACHE_CHAIN_ID = 1337


class DeployedContract(Contract):
    deployment_block: int
    deployment_args: list[Any]
    name: str


def load_contracts_info(contracts_path: Path) -> dict[str, tuple]:
    contracts: dict[str, tuple] = {}
    for path in contracts_path.glob("*.json"):
        if path.name == "__local__.json":
            continue
        with path.open() as fp:
            info = json.load(fp)
        contracts[info["contractName"]] = (
            info["abi"],
            info["runtimeBytecode"].get("bytecode", ""),
        )
    return contracts


def get_commit_id() -> str:
    output = subprocess.check_output(["git", "rev-parse", "HEAD"])
    return output.decode("utf-8").strip()


CONTRACTS_PATH = Path("contracts/.build")
CONTRACTS: dict[str, tuple] = load_contracts_info(CONTRACTS_PATH)


def collect_contracts_info(contracts: dict[str, DeployedContract]) -> dict:
    return {
        name: dict(
            address=contract.address,
            deployment_block=contract.deployment_block,
            deployment_args=contract.deployment_args,
        )
        for name, contract in contracts.items()
    }


def deploy_contract(web3: Web3, constructor_spec: Union[str, Sequence]) -> DeployedContract:
    # constructor_spec is either
    # 1) a contract name e.g. "Foo", or
    # 2) a sequence containing the contract name and
    #    constructor arguments, e.g. ["Foo", "0x1CEE82EEd89Bd5Be5bf2507a92a755dcF1D8e8dc"]
    if isinstance(constructor_spec, str):
        name = constructor_spec
        args: Sequence = ()
    else:
        name = constructor_spec[0]
        args = constructor_spec[1:]

    data = CONTRACTS[name]
    print(f"Deploying {name}")
    ContractFactory = cast(Contract, web3.eth.contract(abi=data[0], bytecode=data[1]))

    receipt = transact(ContractFactory.constructor(*args), timeout=600)

    address = receipt.contractAddress
    deployed = cast(DeployedContract, web3.eth.contract(address=address, abi=data[0]))
    deployed.deployment_block = receipt.blockNumber
    deployed.deployment_args = list(args)
    deployed.name = name

    print(f"Deployed {name} at {address} in {encode_hex(receipt.transactionHash)}")
    return deployed


def _resolve_constructor_args(resolver: Contract, constructor_spec: str | Sequence) -> tuple:
    if isinstance(constructor_spec, str):
        # This is just the contract's name.
        return (constructor_spec,)
    return tuple(resolver.address if arg == "${resolver}" else arg for arg in constructor_spec)


def deploy_beamer(
    account: LocalAccount,
    config: Config,
    chain: Chain,
    resolver: Contract,
    allow_same_chain: bool,
    deploy_mintable_token: bool,
) -> tuple[dict[str, DeployedContract], dict[str, DeployedContract]]:

    web3 = make_web3(chain.rpc, account)
    assert web3.eth.chain_id == chain.chain_id

    deployed_contracts = []
    mintable_token = None
    if deploy_mintable_token:
        mintable_token = deploy_contract(web3, ("MintableToken", int(1e18)))
        deployed_contracts.append(mintable_token)

    l1_messenger = deploy_contract(
        resolver.w3, _resolve_constructor_args(resolver, chain.l1_messenger)
    )
    l2_messenger = deploy_contract(web3, _resolve_constructor_args(resolver, chain.l2_messenger))

    request_manager = deploy_contract(
        web3,
        (
            "RequestManager",
            to_wei(chain.request_manager_arguments.claim_stake, "ether"),
            chain.request_manager_arguments.claim_request_extension,
            chain.request_manager_arguments.claim_period,
            chain.request_manager_arguments.challenge_period_extension,
        ),
    )
    transact(
        request_manager.functions.updateFees(
            chain.fees.min_fee_ppm, chain.fees.lp_fee_ppm, chain.fees.protocol_fee_ppm
        )
    )

    # Configure finality period for each supported target chain
    for other_chain in config.chains:
        if (
            allow_same_chain
            or other_chain is not chain
            or other_chain.chain_id == GANACHE_CHAIN_ID
        ):
            transact(
                request_manager.functions.updateChain(
                    other_chain.chain_id,
                    other_chain.finality_period,
                    other_chain.transfer_cost,
                    other_chain.target_weight_ppm,
                )
            )

    fill_manager = deploy_contract(web3, ("FillManager", l2_messenger.address))
    transact(fill_manager.functions.setResolver(resolver.address))

    # Authorize call chain
    transact(l2_messenger.functions.addCaller(fill_manager.address))
    transact(
        resolver.functions.addCaller(
            chain.chain_id,
            l2_messenger.address,
            l1_messenger.address,
        ),
        timeout=600,
    )
    transact(
        resolver.functions.addRequestManager(
            chain.chain_id, request_manager.address, l1_messenger.address
        ),
        timeout=600,
    )
    transact(l1_messenger.functions.addCaller(resolver.address), timeout=600)
    transact(
        request_manager.functions.addCaller(
            resolver.w3.eth.chain_id,
            l1_messenger.address,
            l2_messenger.address,
        )
    )

    for token in chain.tokens:
        token_address = token.token_address
        if token_address == "mintable_token":
            if mintable_token is None:
                raise ValueError(
                    "Expecting mintable token to be deployed. (option --deploy-mintable-token)"
                )
            token_address = mintable_token.address
        decimals = (
            web3.eth.contract(address=token_address, abi=CONTRACTS["MintableToken"][0])
            .functions.decimals()
            .call()
        )
        token_arguments = (
            token_address,
            token.transfer_limit * 10**decimals,
            int(token.eth_in_token * 10**decimals),
        )
        transact(request_manager.functions.updateToken(*token_arguments))

    l1_contracts = {l1_messenger.name: l1_messenger}
    deployed_contracts.extend(
        [
            request_manager,
            fill_manager,
            l2_messenger,
        ]
    )

    l2_contracts = {deployed.name: deployed for deployed in deployed_contracts}
    return l1_contracts, l2_contracts


@click.command()
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
    "--output-dir",
    type=click.Path(file_okay=False, dir_okay=True, path_type=Path),
    required=True,
    metavar="DIR",
    help="The output directory.",
)
@click.option(
    "--config-file",
    type=click.Path(exists=True, file_okay=True, dir_okay=False, path_type=Path),
    required=True,
    metavar="FILE",
    help="The file containing deployment information.",
)
@click.option(
    "--allow-same-chain/--disallow-same-chain",
    default=False,
    show_default=True,
    help="Whether to allow source and target chains to be the same.",
)
@click.option(
    "--deploy-mintable-token",
    is_flag=True,
    help="Whether to deploy MintableToken.sol on the rollups or not",
)
def main(
    keystore_file: Path,
    password: str,
    output_dir: Path,
    config_file: Path,
    allow_same_chain: bool,
    deploy_mintable_token: bool,
) -> None:
    try:
        config = Config.from_file(config_file)
    except ConfigValidationError as exc:
        print(exc)
        raise SystemExit(1)

    account = account_from_keyfile(keystore_file, password)
    print("Deployer:", account.address)

    def _margin_gas_price_strategy(web3: Web3, transaction_params: TxParams) -> Wei:
        return Wei(int(rpc_gas_price_strategy(web3, transaction_params) * 1.5))

    web3_l1 = make_web3(config.base_chain.rpc, account, _margin_gas_price_strategy)

    resolver = deploy_contract(web3_l1, "Resolver")

    deployment_data: dict = {"beamer_commit": get_commit_id(), "deployer": account.address}
    deployment_data["base_chain"] = collect_contracts_info({"Resolver": resolver})
    deployment_data["chains"] = {}

    output_dir.mkdir(parents=True, exist_ok=True)
    for chain in config.chains:
        print(f"Deploying on {chain.name}...")

        l1_data, l2_data = deploy_beamer(
            account, config, chain, resolver, allow_same_chain, deploy_mintable_token
        )
        deployment_data["base_chain"].update(collect_contracts_info(l1_data))
        deployment_data["chains"][chain.chain_id] = collect_contracts_info(l2_data)
        for contract_name in l2_data:
            shutil.copy(CONTRACTS_PATH / f"{contract_name}.json", output_dir)

    for contract_name in deployment_data["base_chain"]:
        shutil.copy(CONTRACTS_PATH / f"{contract_name}.json", output_dir)

    with output_dir.joinpath("deployment.json").open("w") as f:
        json.dump(deployment_data, f, indent=2)
    print(f"Deployment data stored at {output_dir}")


if __name__ == "__main__":
    main()
