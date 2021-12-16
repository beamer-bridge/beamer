from dataclasses import dataclass

import web3
from web3.contract import Contract

from raisync.typing import Address, BlockNumber


@dataclass
class ContractInfo:
    address: Address
    deployment_block: BlockNumber
    abi: list


def make_contracts(w3: web3.Web3, contracts_info: dict[str, ContractInfo]) -> dict[str, Contract]:
    return {
        name: w3.eth.contract(info.address, abi=info.abi) for name, info in contracts_info.items()
    }
