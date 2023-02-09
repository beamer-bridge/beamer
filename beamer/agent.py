import threading
from concurrent.futures import ThreadPoolExecutor
import structlog
from eth_typing import Address, BlockNumber
from web3 import Web3
from web3.middleware import latest_block_based_cache_middleware

import beamer.metrics
from beamer.chain import POLL_PERIOD, EventMonitor, EventProcessor
from beamer.config import Config
from beamer.contracts import ContractInfo, make_contracts
from beamer.state_machine import Context
from beamer.tracker import Tracker
from beamer.typing import ChainId
from beamer.util import make_web3

log = structlog.get_logger(__name__)


def _get_contracts_info(config: Config, web3: Web3) -> dict[str, ContractInfo]:
    chain_id = ChainId(web3.eth.chain_id)
    info = config.deployment_info.get(chain_id)
    if info is None:
        raise RuntimeError(f"Deployment info for chain ID {chain_id} not available")
    return info


def _get_deployment_block(contract_info: dict[str, ContractInfo]) -> BlockNumber:
    request_manager_deployment_block = contract_info["RequestManager"].deployment_block
    fill_manager_deployment_block = contract_info["FillManager"].deployment_block
    return min(request_manager_deployment_block, fill_manager_deployment_block)


class Agent:
    def __init__(self, config: Config):
        self._config = config
        self._stopped = threading.Event()
        self._stopped.set()
        self._init()

    def _init(self) -> None:
        # Just add one worker, as this effectively serializes the work
        # This is necessary as we use the account for all resolutions and
        # would otherwise run into nonce problems
        self._task_pool = ThreadPoolExecutor(max_workers=1)

        w3_l1 = make_web3(self._config.l1_rpc_url, self._config.account)
        w3_source = make_web3(self._config.l2a_rpc_url, self._config.account)
        w3_target = make_web3(self._config.l2b_rpc_url, self._config.account)

        source_chain_id = ChainId(w3_source.eth.chain_id)
        target_chain_id = ChainId(w3_target.eth.chain_id)
        chain_ids = {source_chain_id, target_chain_id}

        w3_l1.middleware_onion.add(latest_block_based_cache_middleware)

        source_contracts_info = _get_contracts_info(self._config, w3_source)
        target_contracts_info = _get_contracts_info(self._config, w3_target)

        source_contracts = make_contracts(w3_source, source_contracts_info)
        target_contracts = make_contracts(w3_target, target_contracts_info)

        source_request_manager = source_contracts["RequestManager"]
        source_fill_manager = source_contracts["FillManager"]

        target_fill_manager = target_contracts["FillManager"]
        target_request_manager = target_contracts["RequestManager"]

        max_validity_period = source_request_manager.functions.MAX_VALIDITY_PERIOD().call()

        if self._config.unsafe_fill_time >= max_validity_period:
            raise RuntimeError(f"Unsafe fill time must be less than {max_validity_period}")
        if not target_fill_manager.functions.allowedLps(self._config.account.address).call():
            raise RuntimeError("Agent address is not whitelisted on FillManager")
        if not source_request_manager.functions.allowedLps(self._config.account.address).call():
            raise RuntimeError("Agent address is not whitelisted on RequestManager")

        claim_request_extension = source_request_manager.functions.claimRequestExtension().call()

        self.context = Context(
            requests=Tracker(),
            claims=Tracker(),
            source_chain_id=source_chain_id,
            target_chain_id=target_chain_id,
            request_manager=source_request_manager,
            fill_manager=target_fill_manager,
            match_checker=self._config.token_match_checker,
            address=self._config.account.address,
            latest_blocks={},
            config=self._config,
            web3_l1=w3_l1,
            task_pool=self._task_pool,
            claim_request_extension=claim_request_extension,
            l1_resolutions={},
        )

        self._event_processor = EventProcessor(self.context)

        self._event_monitors: dict[ChainId, EventMonitor] = {}

        event_monitor_data = {
            "on_new_events": [self._event_processor.add_events],
            "on_sync_done": self._event_processor.mark_sync_done,
            "poll_period": POLL_PERIOD,
        }

        for chain_id in chain_ids:
            if chain_id == source_chain_id:
                chain_related_data = {
                    "web3": w3_source,
                    "contracts": (source_request_manager, source_fill_manager),
                    "deployment_block": _get_deployment_block(source_contracts_info),
                }
            else:
                chain_related_data = {
                    "web3": w3_target,
                    "contracts": (target_request_manager, target_fill_manager),
                    "deployment_block": _get_deployment_block(target_contracts_info),
                }
            event_monitor_data.update(chain_related_data)
            self._event_monitors[chain_id] = EventMonitor(**event_monitor_data)  # type: ignore

    def start(self) -> None:
        assert self._stopped.is_set()
        beamer.metrics.init(self._config)
        self._event_processor.start()
        for event_monitor in self._event_monitors.values():
            event_monitor.start()
        self._stopped.clear()

    def stop(self) -> None:
        assert not self._stopped.is_set()
        self._event_processor.stop()
        for event_monitor in self._event_monitors.values():
            event_monitor.stop()
        self._task_pool.shutdown(wait=True, cancel_futures=False)
        self._init()
        self._stopped.set()

    @property
    def running(self) -> bool:
        return not self._stopped.is_set()

    @property
    def address(self) -> Address:
        return self._config.account.address

    def wait(self) -> None:
        self._stopped.wait()
