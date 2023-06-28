import json
from dataclasses import dataclass, field
from pathlib import Path

import apischema
from apischema import ValidationError, schema
from apischema.metadata import validators
from eth_typing import ChecksumAddress
from eth_utils import is_checksum_address

from beamer.typing import ChainId


def _validate_token_address(address: str) -> None:
    if address != "mintable_token" and not is_checksum_address(address):
        raise ValidationError(f"expected either 'mintable_token' or a checksum address: {address}")


@dataclass
class _BaseChain:
    name: str
    rpc: str
    chain_id: ChainId = field(metadata=schema(min=1))


@dataclass
class _RequestManagerArgs:
    claim_stake: float = field(metadata=schema(min=0))
    claim_request_extension: int = field(metadata=schema(min=0))
    claim_period: int = field(metadata=schema(min=0))
    challenge_period_extension: int = field(metadata=schema(min=0))


@dataclass
class _Fees:
    min_fee_ppm: int = field(metadata=schema(min=0))
    lp_fee_ppm: int = field(metadata=schema(min=0))
    protocol_fee_ppm: int = field(metadata=schema(min=0))


@dataclass
class _Token:
    token_address: str | ChecksumAddress = field(metadata=validators(_validate_token_address))
    transfer_limit: int = field(metadata=schema(min=0))
    eth_in_token: float = field(metadata=schema(min=0))


@dataclass
class Chain:
    name: str
    chain_id: ChainId = field(metadata=schema(min=1))
    l1_messenger: str | tuple[str | int, ...]
    l2_messenger: str | tuple[str | int, ...]
    finality_period: int = field(metadata=schema(min=1))
    transfer_cost: int = field(metadata=schema(min=0))
    target_weight_ppm: int = field(metadata=schema(min=0))
    request_manager_arguments: _RequestManagerArgs
    fees: _Fees
    tokens: tuple[_Token, ...] = field(metadata=schema(min_items=1))

    @staticmethod
    def from_file(config_file: Path) -> "Chain":
        with open(config_file) as f:
            data = json.load(f)

        try:
            chain = apischema.deserialize(Chain, data)
        except ValidationError as exc:
            raise ConfigValidationError from exc
        return chain


class ConfigValidationError(Exception):
    def __str__(self) -> str:
        assert isinstance(self.__cause__, ValidationError)
        return "\n".join(map(str, self.__cause__.errors))  # pylint: disable=no-member
