import json
import shutil
import subprocess
from pathlib import Path
from typing import Any, cast

import click
from brownie import Wei
from eth_account import Account
from eth_account.signers.local import LocalAccount
from eth_utils import encode_hex
from web3 import HTTPProvider, Web3
from web3.contract import Contract
from web3.middleware import construct_sign_and_send_raw_middleware, geth_poa_middleware

OPTIMISM_L2_MESSENGER_ADDRESS = "0x4200000000000000000000000000000000000007"


class DeployedContract(Contract):
    deployment_block: int
    deployment_args: list[Any]


def account_from_keyfile(keyfile: Path, password: str) -> LocalAccount:
    with open(keyfile, "rt") as fp:
        privkey = Account.decrypt(json.load(fp), password)
    return cast(LocalAccount, Account.from_key(privkey))


def web3_for_rpc(rpc: str, account: LocalAccount) -> Web3:
    web3 = Web3(HTTPProvider(rpc))

    web3.middleware_onion.inject(geth_poa_middleware, layer=0)
    web3.middleware_onion.add(construct_sign_and_send_raw_middleware(account))
    web3.eth.default_account = account.address

    return web3


def load_contracts_info(contracts_path: Path) -> dict[str, tuple]:
    contracts: dict[str, tuple] = {}
    for path in contracts_path.glob("*.json"):
        with path.open() as fp:
            info = json.load(fp)
        contracts[info["contractName"]] = (info["abi"], info["bytecode"])
    return contracts


def get_commit_id() -> str:
    output = subprocess.check_output(["git", "rev-parse", "HEAD"])
    return output.decode("utf-8").strip()


CONTRACTS_PATH = Path("contracts/build/contracts")
CONTRACTS: dict[str, tuple] = load_contracts_info(CONTRACTS_PATH)


def contract_to_json(contracts: dict[str, DeployedContract]) -> dict:
    return {
        name: dict(
            address=contract.address,
            deployment_block=contract.deployment_block,
            deployment_args=contract.deployment_args,
        )
        for name, contract in contracts.items()
    }


def deploy_contract(web3: Web3, name: str, *args: Any) -> DeployedContract:
    data = CONTRACTS[name]
    print(f"Deploying {name}")
    ContractFactory = web3.eth.contract(abi=data[0], bytecode=data[1])

    tx_hash = ContractFactory.constructor(*args).transact()
    tx_receipt = web3.eth.wait_for_transaction_receipt(tx_hash)

    address = tx_receipt.contractAddress  # type: ignore
    deployed = cast(DeployedContract, web3.eth.contract(address=address, abi=data[0]))
    deployed.deployment_block = tx_receipt.blockNumber  # type: ignore
    deployed.deployment_args = list(args)

    print(f"Deployed contract {name} at {address} in {encode_hex(tx_hash)}")
    return deployed


def deploy_l1(web3: Web3) -> dict[str, DeployedContract]:
    resolver = deploy_contract(web3, "Resolver")

    return {"Resolver": resolver}


def deploy_l2(web3: Web3, resolver: Contract) -> dict[str, DeployedContract]:
    token = deploy_contract(web3, "MintableToken", int(1e18))
    resolution_registry = deploy_contract(web3, "ResolutionRegistry")
    resolution_registry.functions.addCaller(
        resolver.web3.eth.chain_id, OPTIMISM_L2_MESSENGER_ADDRESS, resolver.address
    ).transact()

    proof_submitter = deploy_contract(
        web3, "OptimismProofSubmitter", OPTIMISM_L2_MESSENGER_ADDRESS
    )

    claim_stake = Wei("0.00047 ether")
    claim_period = 60 * 60  # 1 hour
    challenge_period = (7 * 24 + 1) * 60 * 60  # 7 days + 1 hour
    challenge_period_extension = 60 * 60  # 1 hour
    request_manager = deploy_contract(
        web3,
        "RequestManager",
        claim_stake,
        claim_period,
        challenge_period,
        challenge_period_extension,
        resolution_registry.address,
    )

    fill_manager = deploy_contract(web3, "FillManager", resolver.address, proof_submitter.address)

    # Authorize call chain
    proof_submitter.functions.addCaller(web3.eth.chain_id, fill_manager.address).transact()

    return {
        "MintableToken": token,
        "ResolutionRegistry": resolution_registry,
        "OptimismProofSubmitter": proof_submitter,
        "RequestManager": request_manager,
        "FillManager": fill_manager,
    }


def update_l1(
    resolver: DeployedContract, l2_chain_id: int, messenger_address: str, deployment_data: dict
) -> None:
    resolver.functions.addCaller(
        l2_chain_id, messenger_address, deployment_data["OptimismProofSubmitter"].address
    ).transact()
    resolver.functions.addRegistry(
        l2_chain_id,
        deployment_data["ResolutionRegistry"].address,
        messenger_address,
    ).transact()


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
def main(keystore_file: Path, password: str, output_dir: Path, config_file: Path) -> None:
    commit_id = get_commit_id()
    account = account_from_keyfile(keystore_file, password)
    with open(config_file) as f:
        config = json.load(f)

    deployment_data: dict = {}

    web3_l1 = web3_for_rpc(config["L1"]["rpc"], account)
    l1_data = deploy_l1(web3_l1)
    resolver = l1_data["Resolver"]

    deployment_data["beamer_commit"] = commit_id
    deployment_data["L1"] = contract_to_json(l1_data)
    deployment_data["L2"] = {}

    output_dir.mkdir(parents=True, exist_ok=True)
    for contract_name in l1_data:
        shutil.copy(CONTRACTS_PATH / f"{contract_name}.json", output_dir)

    for l2_config in config["L2"]:
        name = l2_config["name"]
        print(f"Deployment for {name}")

        web3_l2 = web3_for_rpc(l2_config["rpc"], account)
        chain_id = web3_l2.eth.chain_id
        assert chain_id == l2_config["chain_id"]

        l2_data = deploy_l2(web3_l2, resolver)
        update_l1(resolver, web3_l2.eth.chain_id, l2_config["messenger_contract_address"], l2_data)

        deployment_data["L2"][chain_id] = contract_to_json(l2_data)

        for contract_name in l2_data:
            shutil.copy(CONTRACTS_PATH / f"{contract_name}.json", output_dir)

    with output_dir.joinpath("deployment.json").open("w") as f:
        json.dump(deployment_data, f, indent=2)


if __name__ == "__main__":
    main()
