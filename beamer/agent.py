import threading
from dataclasses import dataclass
from pathlib import Path

import structlog
import web3
from eth_account.signers.local import LocalAccount
from eth_typing import Address
from web3.gas_strategies.rpc import rpc_gas_price_strategy
from web3.middleware import construct_sign_and_send_raw_middleware, geth_poa_middleware

from beamer.chain import ContractEventMonitor, EventProcessor, Tracker
from beamer.contracts import DeploymentInfo, make_contracts
from beamer.request import Request
from beamer.typing import URL, ChainId, RequestId
from beamer.util import TokenMatchChecker

log = structlog.get_logger(__name__)


@dataclass
class Config:
    account: LocalAccount
    deployment_info: DeploymentInfo
    l2a_rpc_url: URL
    l2b_rpc_url: URL
    token_match_file: Path
    fill_wait_time: int


def _make_web3(url: URL, account: LocalAccount) -> web3.Web3:
    w3 = web3.Web3(web3.HTTPProvider(url, request_kwargs=dict(timeout=5)))
    w3.eth.set_gas_price_strategy(rpc_gas_price_strategy)
    # Add POA middleware for geth POA chains, no/op for other chains
    w3.middleware_onion.inject(geth_poa_middleware, layer=0)
    w3.middleware_onion.add(construct_sign_and_send_raw_middleware(account))
    w3.eth.default_account = account.address
    return w3


class Agent:
    def __init__(self, config: Config):
        self._config = config
        self._stopped = threading.Event()
        self._stopped.set()

        w3_l2a = _make_web3(config.l2a_rpc_url, config.account)
        w3_l2b = _make_web3(config.l2b_rpc_url, config.account)

        l2a_contracts_info = config.deployment_info[ChainId(w3_l2a.eth.chain_id)]
        l2b_contracts_info = config.deployment_info[ChainId(w3_l2b.eth.chain_id)]

        l2a_contracts = make_contracts(w3_l2a, l2a_contracts_info)
        l2b_contracts = make_contracts(w3_l2b, l2b_contracts_info)

        request_manager = l2a_contracts["RequestManager"]
        fill_manager = l2b_contracts["FillManager"]

        self.request_tracker: Tracker[RequestId, Request] = Tracker()
        with open(config.token_match_file, "r") as f:
            match_checker = TokenMatchChecker.from_file(f)

        self._event_processor = EventProcessor(
            self.request_tracker,
            request_manager,
            fill_manager,
            match_checker,
            config.fill_wait_time,
        )

        self._contract_monitor_l2a = ContractEventMonitor(
            "RequestManager",
            request_manager,
            l2a_contracts_info["RequestManager"].deployment_block,
            self._event_processor.add_events,
            self._event_processor.mark_sync_done,
        )

        self._contract_monitor_l2b = ContractEventMonitor(
            "FillManager",
            fill_manager,
            l2b_contracts_info["FillManager"].deployment_block,
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
