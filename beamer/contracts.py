import json
from collections import namedtuple
from pathlib import Path
from typing import cast

from web3 import Web3
from web3.contract import Contract

import beamer.artifacts


class ABIManager:
    _CacheEntry = namedtuple("_CacheEntry", ("abi", "deployment_bytecode"))

    def __init__(self, abi_dir: Path):
        self.abi_dir = abi_dir
        self._cache: dict[str, ABIManager._CacheEntry] = {}

    def get_abi(self, name: str) -> str:
        entry = self._cache.get(name)
        if entry is None:
            entry = self._load_entry(name)
            self._cache[name] = entry
        return entry.abi

    def get_deployment_bytecode(self, name: str) -> str:
        entry = self._cache.get(name)
        if entry is None:
            entry = self._load_entry(name)
            self._cache[name] = entry
        return entry.deployment_bytecode

    def _load_entry(self, name: str) -> _CacheEntry:
        path = self.abi_dir.joinpath(f"{name}.json")
        with path.open("rt") as f:
            data = json.load(f)
        return ABIManager._CacheEntry(
            abi=data["abi"], deployment_bytecode=data["deploymentBytecode"]["bytecode"]
        )


def obtain_contract(
    w3: Web3, abi_manager: ABIManager, deployment: beamer.artifacts.Deployment, name: str
) -> Contract:
    chain_id = w3.eth.chain_id

    if chain_id == deployment.base.chain_id and name in deployment.base.contracts:
        address = deployment.base.contracts[name].address
    elif deployment.chain is not None:
        if chain_id == deployment.chain.chain_id and name in deployment.chain.contracts:
            address = deployment.chain.contracts[name].address
    else:
        raise ValueError(f"{name} not found on chain with ID {chain_id} in {deployment}")

    abi = abi_manager.get_abi(name)
    contract = w3.eth.contract(address, abi=abi, decode_tuples=True)
    return cast(Contract, contract)
