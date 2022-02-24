import json
import threading
from dataclasses import dataclass
from pathlib import Path

import structlog
import web3
from eth_account.signers.local import LocalAccount
from eth_typing import Address
from web3.middleware import construct_sign_and_send_raw_middleware, geth_poa_middleware

from raisync.chain import ContractEventMonitor, EventProcessor, RequestTracker
from raisync.contracts import ContractInfo, make_contracts
from raisync.typing import URL
from raisync.util import TokenMatchChecker

log = structlog.get_logger(__name__)


@dataclass
class Config:
    account: LocalAccount
    l2a_contracts_info: dict[str, ContractInfo]
    l2b_contracts_info: dict[str, ContractInfo]
    l2a_rpc_url: URL
    l2b_rpc_url: URL
    token_match_file: Path


def _make_web3(url: URL, account: LocalAccount) -> web3.Web3:
    w3 = web3.Web3(web3.HTTPProvider(url, request_kwargs=dict(timeout=5)))
    # Add POA middleware for geth POA chains, no/op for other chains
    w3.middleware_onion.inject(geth_poa_middleware, layer=0)
    w3.middleware_onion.add(construct_sign_and_send_raw_middleware(account))
    w3.eth.default_account = account.address
    return w3


class Node:
    def __init__(self, config: Config):
        self._config = config
        self._stopped = threading.Event()
        self._stopped.set()

        w3_l2a = _make_web3(config.l2a_rpc_url, config.account)
        w3_l2b = _make_web3(config.l2b_rpc_url, config.account)

        l2a_contracts = make_contracts(w3_l2a, config.l2a_contracts_info)
        l2b_contracts = make_contracts(w3_l2b, config.l2b_contracts_info)

        request_manager = l2a_contracts["RequestManager"]
        fill_manager = l2b_contracts["FillManager"]

        self.request_tracker = RequestTracker()
        with open(config.token_match_file, "r") as f:
            tokens = json.load(f)
            match_checker = TokenMatchChecker(tokens)

        self._event_processor = EventProcessor(
            self.request_tracker, request_manager, fill_manager, match_checker
        )

        self._contract_monitor_l2a = ContractEventMonitor(
            "RequestManager",
            request_manager,
            config.l2a_contracts_info["RequestManager"].deployment_block,
            self._event_processor.add_events,
            self._event_processor.mark_sync_done,
        )

        self._contract_monitor_l2b = ContractEventMonitor(
            "FillManager",
            fill_manager,
            config.l2b_contracts_info["FillManager"].deployment_block,
            self._event_processor.add_events,
            self._event_processor.mark_sync_done,
        )

    def start(self) -> None:
        assert self._stopped.is_set()
        self._event_processor.start()
        self._contract_monitor_l2a.start()
        self._contract_monitor_l2b.start()
        self._stopped.clear()

    def stop(self) -> None:
        assert not self._stopped.is_set()
        self._event_processor.stop()
        self._contract_monitor_l2a.stop()
        self._contract_monitor_l2b.stop()
        self._stopped.set()

    @property
    def running(self) -> bool:
        return not self._stopped.is_set()

    @property
    def address(self) -> Address:
        return self._config.account.address

    def wait(self) -> None:
        self._stopped.wait()
