import json
from dataclasses import dataclass, field
from pathlib import Path

import apischema
from apischema import properties, schema
from apischema.metadata import none_as_undefined, validators
from eth_typing import ChecksumAddress
from eth_utils import is_checksum_address

from beamer.typing import BlockNumber, ChainId


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

    @property
    def earliest_block(self) -> BlockNumber:
        assert self.chain is not None
        return min(info.deployment_block for info in self.chain.contracts.values())


def load(artifacts_dir: Path, chain_id: ChainId) -> Deployment:
    path = next(artifacts_dir.glob(f"{chain_id}-*.deployment.json"))
    deployment = Deployment.from_file(path)
    chain = deployment.chain or deployment.base
    assert chain.chain_id == chain_id
    return deployment


def load_base(artifacts_dir: Path) -> Deployment:
    return Deployment.from_file(artifacts_dir / "base.deployment.json")
