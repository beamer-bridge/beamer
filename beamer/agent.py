import threading
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from itertools import permutations

import structlog
from eth_typing import Address, BlockNumber
from web3 import Web3
from web3.contract import Contract
from web3.middleware import latest_block_based_cache_middleware

import beamer.metrics
from beamer.chain import POLL_PERIOD, EventMonitor, EventProcessor
from beamer.config import Config
from beamer.contracts import ContractInfo, make_contracts
from beamer.state_machine import Context
from beamer.tracker import Tracker
from beamer.typing import URL, ChainId, TransferDirection
from beamer.util import make_web3

log = structlog.get_logger(__name__)


def _get_contracts_info(config: Config, chain_id: ChainId) -> dict[str, ContractInfo]:
    info = config.deployment_info.get(chain_id)
    if info is None:
        raise RuntimeError(f"Deployment info for chain ID {chain_id} not available")
    return info


def _get_deployment_block(contract_info: dict[str, ContractInfo]) -> BlockNumber:
    request_manager_deployment_block = contract_info["RequestManager"].deployment_block
    fill_manager_deployment_block = contract_info["FillManager"].deployment_block
    return min(request_manager_deployment_block, fill_manager_deployment_block)


@dataclass
class _BaseChain:
    w3: Web3
    id: ChainId
    rpc_url: URL


@dataclass
class _Chain(_BaseChain):
    contracts_info: dict[str, ContractInfo]
    contracts: dict[str, Contract]

    @property
    def request_manager(self) -> Contract:
        return self.contracts["RequestManager"]

    @property
    def fill_manager(self) -> Contract:
        return self.contracts["FillManager"]


class Agent:
    def __init__(self, config: Config):
        self._config = config
        self._stopped = threading.Event()
        self._stopped.set()
        self._init()

    def _init_l1_chain(self) -> _BaseChain:
        l1_w3 = make_web3(self._config.rpc_urls["l1"], self._config.account)
        l1_w3.middleware_onion.add(latest_block_based_cache_middleware)
        chain_id = ChainId(l1_w3.eth.chain_id)
        return _BaseChain(w3=l1_w3, id=chain_id, rpc_url=self._config.rpc_urls["l1"])

    def _init_chains(self) -> dict[ChainId, _Chain]:
        chains: dict[ChainId, _Chain] = {}
        for chain_name, rpc_url in self._config.rpc_urls.items():
            if chain_name == "l1":
                continue
            w3 = make_web3(rpc_url, self._config.account)
            chain_id = ChainId(w3.eth.chain_id)
            if chain_id in chains:
                continue
            contracts_info = _get_contracts_info(self._config, chain_id)
            contracts = make_contracts(w3, contracts_info)
            request_manager = contracts["RequestManager"]
            fill_manager = contracts["FillManager"]
            self._event_monitors[chain_id] = EventMonitor(
                web3=w3,
                contracts=(request_manager, fill_manager),
                deployment_block=_get_deployment_block(contracts_info),
                poll_period=POLL_PERIOD,
                on_new_events=[],
                on_sync_done=[],
            )
            chains[chain_id] = _Chain(
                w3=w3,
                id=chain_id,
                rpc_url=rpc_url,
                contracts_info=contracts_info,
                contracts=contracts,
            )
        return chains

    def _check_source_chain(self, source_chain: _Chain) -> None:
        max_validity_period = source_chain.request_manager.functions.MAX_VALIDITY_PERIOD().call()

        if self._config.unsafe_fill_time >= max_validity_period:
            raise RuntimeError(f"Unsafe fill time must be less than {max_validity_period}")

        if not source_chain.request_manager.functions.allowedLps(
            self._config.account.address
        ).call():
            raise RuntimeError("Agent address is not whitelisted on RequestManager")

    def _check_target_chain(self, target_chain: _Chain) -> None:
        if not target_chain.fill_manager.functions.allowedLps(self._config.account.address).call():
            raise RuntimeError("Agent address is not whitelisted on FillManager")

    def _setup_direction(
        self, direction: TransferDirection, chains: dict[ChainId, _Chain], l1: _BaseChain
    ) -> None:
        source_chain = chains[direction.source]
        target_chain = chains[direction.target]

        self._check_source_chain(source_chain)
        self._check_target_chain(target_chain)

        claim_request_extension = (
            source_chain.request_manager.functions.claimRequestExtension().call()
        )

        logger = structlog.get_logger("Context").bind(
            source_chain_id=source_chain.id, target_chain_id=target_chain.id
        )

        context = Context(
            requests=Tracker(),
            claims=Tracker(),
            source_chain_id=source_chain.id,
            target_chain_id=target_chain.id,
            request_manager=source_chain.request_manager,
            fill_manager=target_chain.fill_manager,
            token_checker=self._config.token_checker,
            address=self._config.account.address,
            latest_blocks={},
            config=self._config,
            web3_l1=l1.w3,
            task_pool=self._task_pool,
            claim_request_extension=claim_request_extension,
            l1_resolutions={},
            l1_invalidations={},
            logger=logger,
        )
        event_processor = EventProcessor(context)
        self._event_monitors[direction.source].subscribe(event_processor)
        if source_chain.id != target_chain.id:
            self._event_monitors[direction.target].subscribe(event_processor)
        self._event_processors[direction] = event_processor

    def _init(self) -> None:
        # Just add one worker, as this effectively serializes the work
        # This is necessary as we use the account for all resolutions and
        # would otherwise run into nonce problems
        self._task_pool = ThreadPoolExecutor(max_workers=1)
        self._event_processors: dict[TransferDirection, EventProcessor] = {}
        self._event_monitors: dict[ChainId, EventMonitor] = {}
        l1 = self._init_l1_chain()
        chains = self._init_chains()
        chain_ids = list(chains.keys())
        if len(chain_ids) == 1:
            chain_ids.append(chain_ids[0])

        directions = permutations(chain_ids, 2)

        for direction in set(directions):
            direction = TransferDirection(direction[0], direction[1])
            self._setup_direction(direction, chains, l1)

    def start(self) -> None:
        assert self._stopped.is_set()
        for event_processor in self._event_processors.values():
            beamer.metrics.init(
                config=self._config,
                source_rpc_url=event_processor.context.source_rpc_url,
                target_rpc_url=event_processor.context.target_rpc_url,
            )
            event_processor.start()
        for event_monitor in self._event_monitors.values():
            event_monitor.start()
        self._stopped.clear()

    def get_context(self, direction: TransferDirection) -> Context:
        event_processor = self.get_event_processor(direction)
        return event_processor.context

    def get_event_processor(self, direction: TransferDirection) -> EventProcessor:
        return self._event_processors[direction]

    def stop(self) -> None:
        assert not self._stopped.is_set()
        for event_processor in self._event_processors.values():
            event_processor.stop()
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
