import json
from dataclasses import dataclass
from pathlib import Path
from typing import cast

import web3
from web3 import Web3
from web3.contract import Contract

import beamer.deploy.artifacts
from beamer.typing import BlockNumber, ChainId, ChecksumAddress


@dataclass
class ContractInfo:
    address: ChecksumAddress
    deployment_block: BlockNumber
    abi: list


def make_contracts(w3: web3.Web3, contracts_info: dict[str, ContractInfo]) -> dict[str, Contract]:
    return {
        name: cast(Contract, w3.eth.contract(info.address, abi=info.abi, decode_tuples=True))
        for name, info in contracts_info.items()
    }


def load_contract_abi(abi_dir: Path, contract_name: str) -> list:
    with abi_dir.joinpath(f"{contract_name}.json").open("rt") as f:
        data = json.load(f)
    return data["abi"]


DeploymentInfo = dict[ChainId, dict[str, ContractInfo]]


def prepare_deployment_infos(
    abi_dir: Path, contracts: dict[str, beamer.deploy.artifacts.DeployedContractInfo]
) -> dict[str, ContractInfo]:
    abis = {}
    infos = {}
    for name, contract in contracts.items():
        if name not in abis:
            abis[name] = load_contract_abi(abi_dir, name)
        abi = abis[name]
        infos[name] = ContractInfo(
            address=contract.address,
            deployment_block=contract.deployment_block,
            abi=abi,
        )
    return infos


def load_deployment_info(artifacts_dir: Path, abi_dir: Path) -> DeploymentInfo:
    deployment_info = {}
    for artifact_path in artifacts_dir.glob("*.deployment.json"):
        deployment = beamer.deploy.artifacts.Deployment.from_file(artifact_path)
        if deployment.chain is None:
            continue
        deployment_info[deployment.chain.chain_id] = prepare_deployment_infos(
            abi_dir, deployment.chain.contracts
        )
    return deployment_info


def contracts_for_web3(web3: Web3, artifacts_dir: Path, abi_dir: Path) -> dict[str, Contract]:
    deployment_info = load_deployment_info(artifacts_dir, abi_dir)
    chain_id = ChainId(web3.eth.chain_id)
    return make_contracts(web3, deployment_info[chain_id])


def obtain_contract(
    w3: Web3, abi_dir: Path, deployment: beamer.deploy.artifacts.Deployment, name: str
) -> Contract:
    chain_id = w3.eth.chain_id

    if chain_id == deployment.base.chain_id and name in deployment.base.contracts:
        address = deployment.base.contracts[name].address
    elif deployment.chain is not None:
        if chain_id == deployment.chain.chain_id and name in deployment.chain.contracts:
            address = deployment.chain.contracts[name].address
    else:
        raise ValueError(f"{name} not found on chain with ID {chain_id} in {deployment}")

    abi = load_contract_abi(abi_dir, name)
    contract = w3.eth.contract(address, abi=abi, decode_tuples=True)
    return cast(Contract, contract)
