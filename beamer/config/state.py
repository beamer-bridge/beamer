import copy
import hashlib
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Generator, TypeVar

import apischema
from apischema import schema, validator
from apischema.metadata import alias, order
from apischema.objects import get_alias
from eth_typing import ChecksumAddress
from eth_utils import is_checksum_address

from beamer.typing import BlockNumber, ChainId


T = TypeVar("T")


class ValidationError(Exception):
    def __str__(self) -> str:
        if self.__cause__ is None:
            return super().__str__()
        assert isinstance(self.__cause__, apischema.ValidationError)
        return "\n".join(map(str, self.__cause__.errors))  # pylint: disable=no-member


@dataclass
class TokenConfig:
    transfer_limit: int = field(metadata=schema(min=0))
    eth_in_token: int = field(metadata=schema(min=0))


@dataclass
class ChainConfig:
    finality_period: int = field(metadata=schema(min=0))
    target_weight_ppm: int = field(metadata=schema(min=0, max=999_999))
    transfer_cost: int = field(metadata=schema(min=0))


@dataclass
class FillManagerConfig:
    whitelist: list[ChecksumAddress]


@dataclass
class RequestManagerConfig:
    min_fee_ppm: int = field(metadata=schema(min=0))
    lp_fee_ppm: int = field(metadata=schema(min=0, max=999_999))
    protocol_fee_ppm: int = field(metadata=schema(min=0, max=999_999))
    chains: dict[ChainId, ChainConfig]
    tokens: dict[str, TokenConfig]
    whitelist: list[ChecksumAddress]


@dataclass
class _BaseConfiguration:
    chain_id: ChainId = field(metadata=schema(min=1))
    token_addresses: dict[str, ChecksumAddress]
    request_manager: RequestManagerConfig = field(metadata=alias("RequestManager"))
    fill_manager: FillManagerConfig = field(metadata=alias("FillManager"))

    @validator
    def _check_token_addresses(self) -> Generator:
        for name, address in self.token_addresses.items():
            if not is_checksum_address(address):
                loc = get_alias(self).token_addresses, name
                yield loc, f"expected a checksum address: {address}"

    @validator
    def _check_tokens(self) -> Generator:
        # Make sure each token symbol has its entry in token_addresses.
        for name in self.request_manager.tokens:
            if name not in self.token_addresses:
                loc = get_alias(self).token_addresses
                yield loc, f"missing address for token {name}"

    @staticmethod
    def _convert_chain_ids(data: dict) -> None:
        # convert chain ID strings to integers, since the schema expects
        # integers
        if "RequestManager" in data:
            chains = data["RequestManager"].get("chains")
            if chains is not None:
                new_chains = {}
                for chain_id, value in chains.items():
                    try:
                        chain_id = ChainId(int(chain_id))
                    except ValueError as exc:
                        raise ValidationError(f"invalid chain ID: {chain_id}") from exc
                    new_chains[chain_id] = value
                data["RequestManager"]["chains"] = new_chains

    def clone(self: T) -> T:
        return copy.deepcopy(self)


@dataclass
class DesiredConfiguration(_BaseConfiguration):
    @staticmethod
    def from_file(path: Path) -> "DesiredConfiguration":
        with open(path, "rt") as f:
            data = json.load(f)

        _BaseConfiguration._convert_chain_ids(data)
        try:
            config = apischema.deserialize(DesiredConfiguration, data)
        except apischema.ValidationError as exc:
            raise ValidationError from exc
        return config

    def to_file(self, path: Path) -> None:
        data = apischema.serialize(self)
        with open(path, "wt") as f:
            json.dump(data, f, indent=4)

    def to_config(self, block: BlockNumber) -> "Configuration":
        data = apischema.serialize(self, no_copy=False)
        data["block"] = block
        return apischema.deserialize(Configuration, data)


@dataclass
class Configuration(_BaseConfiguration):
    block: BlockNumber = field(metadata=schema(min=1) | order(-1))

    def compute_checksum(self) -> str:
        data = apischema.serialize(self)
        # We add a newline at the end so that one can easily compute the checksum
        # using common tools e.g.
        #
        #   grep -v checksum state-file | sha256sum
        #   jq --indent 4 'del(.checksum)' state-file | sha256sum
        serialized = json.dumps(data, indent=4) + "\n"
        return hashlib.sha256(serialized.encode("utf-8")).digest().hex()

    @staticmethod
    def initial(chain_id: ChainId, block: BlockNumber) -> "Configuration":
        fm_config = FillManagerConfig(whitelist=[])
        rm_config = RequestManagerConfig(
            min_fee_ppm=0, lp_fee_ppm=0, protocol_fee_ppm=0, chains={}, tokens={}, whitelist=[]
        )
        return Configuration(
            block=block,
            chain_id=chain_id,
            token_addresses={},
            request_manager=rm_config,
            fill_manager=fm_config,
        )

    def to_desired_config(self) -> DesiredConfiguration:
        data = apischema.serialize(self, no_copy=False)
        del data["block"]
        return apischema.deserialize(DesiredConfiguration, data)

    @staticmethod
    def from_file(path: Path) -> "Configuration":
        with open(path, "rt") as f:
            data = json.load(f)

        _BaseConfiguration._convert_chain_ids(data)
        checksum = data.pop("checksum")
        try:
            config = apischema.deserialize(Configuration, data)
        except apischema.ValidationError as exc:
            raise ValidationError from exc

        computed_checksum = config.compute_checksum()
        if checksum != computed_checksum:
            raise ValidationError(f"checksum mismatch: {checksum} (expected {computed_checksum})")
        return config

    def to_file(self, path: Path) -> None:
        # Make sure the checksum is added first so it is the first field to appear.
        # We do that so it is easy to remove it from the JSON output, e.g. by using grep.
        data = dict(checksum=self.compute_checksum(), **apischema.serialize(self))
        with open(path, "wt") as f:
            json.dump(data, f, indent=4)
