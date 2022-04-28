import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import structlog
import web3
from eth_account.signers.local import LocalAccount
from eth_typing import Address
from web3.gas_strategies.rpc import rpc_gas_price_strategy
from web3.middleware import construct_sign_and_send_raw_middleware, geth_poa_middleware

import beamer.metrics
from beamer.chain import EventMonitor, EventProcessor
from beamer.contracts import DeploymentInfo, make_contracts
from beamer.state_machine import Context
from beamer.tracker import Tracker
from beamer.typing import URL, ChainId
from beamer.util import TokenMatchChecker

log = structlog.get_logger(__name__)


@dataclass
class Config:
    account: LocalAccount
    deployment_info: DeploymentInfo
    l1_rpc_url: URL
    l2a_rpc_url: URL
    l2b_rpc_url: URL
    token_match_file: Path
    fill_wait_time: int
    prometheus_metrics_port: Optional[int]


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

        w3_l1 = _make_web3(config.l1_rpc_url, config.account)
        w3_l2a = _make_web3(config.l2a_rpc_url, config.account)
        w3_l2b = _make_web3(config.l2b_rpc_url, config.account)

        l2a_contracts_info = config.deployment_info[ChainId(w3_l2a.eth.chain_id)]
        l2b_contracts_info = config.deployment_info[ChainId(w3_l2b.eth.chain_id)]

        l2a_contracts = make_contracts(w3_l2a, l2a_contracts_info)
        l2b_contracts = make_contracts(w3_l2b, l2b_contracts_info)

        request_manager = l2a_contracts["RequestManager"]
        resolution_registry = l2a_contracts["ResolutionRegistry"]
        fill_manager = l2b_contracts["FillManager"]

        if not fill_manager.functions.allowedLPs(config.account.address).call():
            raise RuntimeError("Agent address is not whitelisted")

        with open(config.token_match_file, "r") as f:
            match_checker = TokenMatchChecker.from_file(f)

        self.context = Context(
            requests=Tracker(),
            claims=Tracker(),
            request_manager=request_manager,
            fill_manager=fill_manager,
            match_checker=match_checker,
            fill_wait_time=config.fill_wait_time,
            address=config.account.address,
            latest_blocks={},
            web3_l1=w3_l1,
        )
        self._event_processor = EventProcessor(self.context)

        self._event_monitor_l2a = EventMonitor(
            web3=w3_l2a,
            contracts=(request_manager, resolution_registry),
            deployment_block=min(
                l2a_contracts_info["RequestManager"].deployment_block,
                l2a_contracts_info["ResolutionRegistry"].deployment_block,
            ),
            on_new_events=self._event_processor.add_events,
            on_sync_done=self._event_processor.mark_sync_done,
        )

        self._event_monitor_l2b = EventMonitor(
            web3=w3_l2b,
            contracts=(fill_manager,),
            deployment_block=l2b_contracts_info["FillManager"].deployment_block,
            on_new_events=self._event_processor.add_events,
            on_sync_done=self._event_processor.mark_sync_done,
        )

    def start(self) -> None:
        assert self._stopped.is_set()
        beamer.metrics.init(self._config)
        self._event_processor.start()
        self._event_monitor_l2a.start()
        self._event_monitor_l2b.start()
        self._stopped.clear()

    def stop(self) -> None:
        assert not self._stopped.is_set()
        self._event_processor.stop()
        self._event_monitor_l2a.stop()
        self._event_monitor_l2b.stop()
        self._stopped.set()

    @property
    def running(self) -> bool:
        return not self._stopped.is_set()

    @property
    def address(self) -> Address:
        return self._config.account.address

    def wait(self) -> None:
        self._stopped.wait()
