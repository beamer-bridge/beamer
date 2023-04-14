import json
from dataclasses import dataclass, field
from pathlib import Path

from apischema import deserialize, schema

from beamer.agent.typing import URL


@dataclass
class ChainConfig:
    name: str
    rpc: URL
    tokens: list[list[str]] = field(default_factory=list)


@dataclass
class Param:
    key: str | int | None = field(default=None)
    values: dict[str, str | int] = field(default_factory=dict)


@dataclass
class Command:
    name: str
    params: list[Param]


@dataclass
class Config:
    deployment_dir: str
    chains: dict[str, ChainConfig] = field(metadata=schema(min_items=1))
    commands: list[Command] = field(metadata=schema(min_items=1))

    @staticmethod
    def from_file(config_file: Path) -> "Config":
        with open(config_file) as f:
            config = json.load(f)
        return deserialize(Config, config)
