import json
from collections.abc import Sequence
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

import apischema
from apischema import properties, schema
from apischema.metadata import none_as_undefined, validators
from eth_typing import ChecksumAddress
from eth_utils import is_checksum_address
from web3 import Web3
from web3.contract import Contract

from beamer.deploy.util import DeployedContract, make_contract
from beamer.typing import BlockNumber, ChainId
from beamer.util import get_commit_id


class ValidationError(Exception):
    def __str__(self) -> str:
        assert isinstance(self.__cause__, apischema.ValidationError)
        return "\n".join(map(str, self.__cause__.errors))  # pylint: disable=no-member


def _validate_address(address: str) -> None:
    if not is_checksum_address(address):
        raise apischema.ValidationError(f"expected a checksum address: {address}")


@dataclass
class DeployedContractInfo:
    beamer_commit: str
    tx_hash: str
    address: ChecksumAddress = field(metadata=validators(_validate_address))
    deployment_block: BlockNumber = field(metadata=schema(min=0))
    deployment_args: list[str | int]

    @staticmethod
    def from_deployed_contract(contract: DeployedContract) -> "DeployedContractInfo":
        beamer_commit = get_commit_id()
        return DeployedContractInfo(
            beamer_commit=beamer_commit,
            tx_hash=contract.deployment_txhash,
            address=contract.address,
            deployment_block=contract.deployment_block,
            deployment_args=contract.deployment_args,
        )


@dataclass(frozen=True)
class ChainDeployment:
    chain_id: ChainId = field(metadata=schema(min=1))
    contracts: dict[str, DeployedContractInfo] = field(metadata=properties)


@dataclass(frozen=True)
class Deployment:
    deployer: ChecksumAddress
    base: ChainDeployment
    chain: ChainDeployment | None = field(default=None, metadata=none_as_undefined)

    @staticmethod
    def from_file(artifact: Path) -> "Deployment":
        with open(artifact, "rt") as f:
            data = json.load(f)

        try:
            deployment = apischema.deserialize(Deployment, data)
        except apischema.ValidationError as exc:
            raise ValidationError from exc
        return deployment

    def to_file(self, artifact: Path) -> None:
        with open(artifact, "wt") as f:
            json.dump(apischema.serialize(self), f, indent=4)

    def obtain_contract(self, w3: Web3, chain: Literal["base", "chain"], name: str) -> Contract:
        chain_id = getattr(self, chain).chain_id
        address = getattr(self, chain).contracts[name].address
        assert w3.eth.chain_id == chain_id
        return make_contract(w3, name, address)


def generate(
    path: Path,
    deployer: ChecksumAddress,
    base: Sequence[DeployedContract],
    chain: Sequence[DeployedContract] = (),
) -> None:
    base_contracts = {}
    for contract in base:
        base_contracts[contract.name] = DeployedContractInfo.from_deployed_contract(contract)

    chain_contracts = {}
    for contract in chain:
        chain_contracts[contract.name] = DeployedContractInfo.from_deployed_contract(contract)

    base_chain_id = ChainId(next(iter(base)).w3.eth.chain_id)
    base_deployment = ChainDeployment(chain_id=base_chain_id, contracts=base_contracts)

    if chain_contracts:
        chain_id = ChainId(next(iter(chain)).w3.eth.chain_id)
        chain_deployment = ChainDeployment(chain_id=chain_id, contracts=chain_contracts)
    else:
        chain_deployment = None

    deployment = Deployment(deployer=deployer, base=base_deployment, chain=chain_deployment)
    deployment.to_file(path)
