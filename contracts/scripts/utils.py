import json
from typing import Any, Dict, Optional

from brownie import ResolutionRegistry, Resolver, web3
from eth_utils.abi import event_abi_to_log_topic
from web3._utils.abi import filter_by_type
from web3.contract import get_event_data

_ADDRESS_FILE = "../addresses.json"


PROXY_OVM_L1_CROSS_DOMAIN_MESSENGER = "Proxy__OVM_L1CrossDomainMessenger"
RESOLVER = "Resolver"
RESOLUTION_REGISTRY = "ResolutionRegistry"
OPTIMISM_PROOF_SUBMITTER = "OptimismProofSubmitter"
REQUEST_MANAGER = "RequestManager"
FILL_MANAGER = "FillManager"

L1_CHAIN_ID = 31337
L2_CHAIN_ID = 420

OPTIMISM_L2_MESSENGER_ADDRESS = "0x4200000000000000000000000000000000000007"


def get_contract_address(name: str) -> str:
    with open(_ADDRESS_FILE, mode="r") as f:
        contracts = json.load(f)

        return contracts[name]


def save_contract_address(name: str, address: str) -> None:
    with open(_ADDRESS_FILE, mode="r") as f:
        contracts = json.load(f)

    contracts[name] = address

    with open(_ADDRESS_FILE, "w") as f:
        json.dump(contracts, f, indent=2)


def _create_event_topic_to_abi_dict() -> dict:
    event_abis = {}
    events = filter_by_type("event", Resolver.abi)
    events.extend(filter_by_type("event", ResolutionRegistry.abi))

    for event_abi in events:
        event_topic = event_abi_to_log_topic(event_abi)  # type: ignore
        event_abis[event_topic] = event_abi

    return event_abis


_EVENT_ABIS = _create_event_topic_to_abi_dict()


def decode_event(log_entry: Any) -> Optional[Dict]:
    topic = log_entry["topics"][0]
    try:
        event_abi = _EVENT_ABIS[topic]
    except Exception:
        return None

    return get_event_data(abi_codec=web3.codec, event_abi=event_abi, log_entry=log_entry)
