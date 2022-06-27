import threading
from concurrent.futures import ThreadPoolExecutor

import structlog
from eth_typing import Address

import beamer.metrics
from beamer.chain import POLL_PERIOD_MAINNET, POLL_PERIOD_TESTNET, EventMonitor, EventProcessor
from beamer.config import Config
from beamer.contracts import make_contracts
from beamer.state_machine import Context
from beamer.tracker import Tracker
from beamer.typing import ChainId
from beamer.util import TokenMatchChecker, make_web3

log = structlog.get_logger(__name__)


class Agent:
    def __init__(self, config: Config):
        self._config = config
        self._stopped = threading.Event()
        self._stopped.set()
        # Just add one worker, as this effectively serializes the work
        # This is necessary as we use the account for all resolutions and
        # would otherwise run into nonce problems
        self._task_pool = ThreadPoolExecutor(max_workers=1)

        w3_l1 = make_web3(config.l1_rpc_url, config.account)
        w3_l2a = make_web3(config.l2a_rpc_url, config.account)
        w3_l2b = make_web3(config.l2b_rpc_url, config.account)

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
            address=config.account.address,
            latest_blocks={},
            config=config,
            web3_l1=w3_l1,
            task_pool=self._task_pool,
            l1_resolutions={},
        )

        chain_id = w3_l1.eth.chain_id
        poll_period = POLL_PERIOD_MAINNET if chain_id == 1 else POLL_PERIOD_TESTNET

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
            poll_period=poll_period,
        )

        self._event_monitor_l2b = EventMonitor(
            web3=w3_l2b,
            contracts=(fill_manager,),
            deployment_block=l2b_contracts_info["FillManager"].deployment_block,
            on_new_events=self._event_processor.add_events,
            on_sync_done=self._event_processor.mark_sync_done,
            poll_period=poll_period,
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
        self._task_pool.shutdown(wait=True, cancel_futures=False)
        self._stopped.set()

    @property
    def running(self) -> bool:
        return not self._stopped.is_set()

    @property
    def address(self) -> Address:
        return self._config.account.address

    def wait(self) -> None:
        self._stopped.wait()
