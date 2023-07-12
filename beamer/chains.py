from dataclasses import dataclass
from typing import Any

from beamer.typing import ChainId


@dataclass(frozen=True)
class ChainDescriptor:
    id: ChainId
    ecosystem_name: str
    name: str
    type2: bool = False
    bedrock: bool = False
    testnet: bool = False
    local: bool = False


_DESCRIPTORS = {
    # Ethereum
    ChainId(1): ChainDescriptor(
        id=ChainId(1), ecosystem_name="ethereum", name="mainnet", type2=True
    ),
    ChainId(5): ChainDescriptor(
        id=ChainId(5), ecosystem_name="ethereum", name="goerli", type2=True, testnet=True
    ),
    ChainId(1337): ChainDescriptor(
        id=ChainId(1337), ecosystem_name="ethereum", name="local", type2=True, local=True
    ),
    ChainId(900): ChainDescriptor(
        id=ChainId(900), ecosystem_name="ethereum", name="op-l1", local=True
    ),
    # Optimism
    ChainId(10): ChainDescriptor(
        id=ChainId(10), ecosystem_name="optimism", name="mainnet", type2=True, bedrock=True
    ),
    ChainId(420): ChainDescriptor(
        id=ChainId(420),
        ecosystem_name="optimism",
        name="goerli",
        type2=True,
        bedrock=True,
        testnet=True,
    ),
    ChainId(901): ChainDescriptor(
        id=ChainId(901),
        ecosystem_name="optimism",
        name="local",
        type2=True,
        bedrock=True,
        local=True,
    ),
    # Arbitrum
    ChainId(42161): ChainDescriptor(id=ChainId(42161), ecosystem_name="arbitrum", name="mainnet"),
    ChainId(421613): ChainDescriptor(
        id=ChainId(421613), ecosystem_name="arbitrum", name="goerli", testnet=True
    ),
    ChainId(412346): ChainDescriptor(
        id=ChainId(412346), ecosystem_name="arbitrum", name="local", local=True
    ),
    # Polygon ZkEVM
    ChainId(1101): ChainDescriptor(
        id=ChainId(1101), ecosystem_name="polygon_zkevm", name="mainnet"
    ),
    ChainId(1442): ChainDescriptor(
        id=ChainId(1442), ecosystem_name="polygon_zkevm", name="goerli", testnet=True
    ),
    ChainId(1001): ChainDescriptor(
        id=ChainId(1001), ecosystem_name="polygon_zkevm", name="local", local=True
    ),
    # Base
    ChainId(84531): ChainDescriptor(
        id=ChainId(84531),
        ecosystem_name="base",
        name="goerli",
        testnet=True,
        bedrock=True,
        type2=True,
    ),
}


def get_chain_descriptor(chain_id: ChainId) -> ChainDescriptor | None:
    return _DESCRIPTORS.get(chain_id)


def search(**kwargs: Any) -> tuple[ChainDescriptor, ...]:
    found = []
    for desc in _DESCRIPTORS.values():
        if all(getattr(desc, field, None) == value for field, value in kwargs.items()):
            found.append(desc)
    return tuple(found)


def register(chain_id: ChainId, descriptor: ChainDescriptor) -> None:
    assert chain_id not in _DESCRIPTORS, "Chain is already added"
    _DESCRIPTORS[chain_id] = descriptor


def unregister(chain_id: ChainId) -> None:
    del _DESCRIPTORS[chain_id]
