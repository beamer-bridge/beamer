import json
from dataclasses import dataclass, field
from pathlib import Path

import apischema
from apischema import ValidationError, schema
from beamer.typing import ChainId


@dataclass
class _RequestManagerArgs:
    claim_stake: float = field(metadata=schema(min=0))
    claim_request_extension: int = field(metadata=schema(min=0))
    claim_period: int = field(metadata=schema(min=0))
    challenge_period_extension: int = field(metadata=schema(min=0))


@dataclass
class Chain:
    name: str
    chain_id: ChainId = field(metadata=schema(min=1))
    l1_messenger: str | tuple[str | int, ...]
    l2_messenger: str | tuple[str | int, ...]
    request_manager_arguments: _RequestManagerArgs

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
