import threading
from concurrent.futures import ThreadPoolExecutor
from itertools import permutations

import structlog
from eth_typing import Address, ChecksumAddress
from web3.middleware import latest_block_based_cache_middleware

import beamer.agent.metrics
from beamer.agent.chain import EventMonitor, EventProcessor
from beamer.agent.config import Config
from beamer.agent.state_machine import Context
from beamer.agent.tracker import Tracker
from beamer.agent.util import BaseChain, Chain
from beamer.contracts import ABIManager, obtain_contract
from beamer.typing import ChainId, TransferDirection
from beamer.util import make_web3

log = structlog.get_logger(__name__)


class Agent:
    def __init__(self, config: Config):
        self._config = config
        self._stopped = threading.Event()
        self._stopped.set()
        self._abi_manager = ABIManager(config.abi_dir)
        self._init()

    def _init_l1_chain(self) -> BaseChain:
        l1_w3 = make_web3(self._config.base_chain_rpc_url, self._config.account)
        l1_w3.middleware_onion.add(latest_block_based_cache_middleware)
        return BaseChain(w3=l1_w3, id=ChainId(l1_w3.eth.chain_id))

    def _init_chains(self) -> dict[ChainId, Chain]:
        chains: dict[ChainId, Chain] = {}
        for chain_name, chain_config in self._config.chains.items():
            w3 = make_web3(chain_config.rpc_url, self._config.account)
            chain_id = ChainId(w3.eth.chain_id)
            if chain_id in chains:
                continue

            deployment = beamer.artifacts.load(self._config.artifacts_dir, chain_id)
            if deployment is None:
                raise RuntimeError(f"Deployment artifact for chain ID {chain_id} not available")

            assert deployment.chain is not None
            request_manager = obtain_contract(w3, self._abi_manager, deployment, "RequestManager")
            fill_manager = obtain_contract(w3, self._abi_manager, deployment, "FillManager")

            self._event_monitors[chain_id] = EventMonitor(
                web3=w3,
                contracts=(request_manager, fill_manager),
                deployment_block=deployment.earliest_block,
                poll_period=chain_config.poll_period,
                confirmation_blocks=chain_config.confirmation_blocks,
                on_new_events=[],
                on_sync_done=[],
                on_rpc_status_change=[],
            )
            chains[chain_id] = Chain(
                w3=w3,
                id=chain_id,
                name=chain_name,
                tokens=self._config.token_checker.get_tokens_for_chain(chain_id),
                request_manager=request_manager,
                fill_manager=fill_manager,
            )
        return chains

    def _check_source_chain(self, source_chain: Chain) -> None:
        max_validity_period = source_chain.request_manager.functions.MAX_VALIDITY_PERIOD().call()

        if self._config.unsafe_fill_time >= max_validity_period:
            raise RuntimeError(f"Unsafe fill time must be less than {max_validity_period}")

        if not source_chain.request_manager.functions.allowedLps(
            self._config.account.address
        ).call():
            raise RuntimeError("Agent address is not whitelisted on RequestManager")

    def _check_target_chain(self, target_chain: Chain) -> None:
        if not target_chain.fill_manager.functions.allowedLps(self._config.account.address).call():
            raise RuntimeError("Agent address is not whitelisted on FillManager")

    def _init_fill_mutexes(
        self, chains: dict[ChainId, Chain]
    ) -> dict[tuple[ChainId, ChecksumAddress], threading.Lock]:
        mutexes: dict[tuple[ChainId, ChecksumAddress], threading.Lock] = {}
        for chain in chains.values():
            for chain_id, address in chain.tokens:
                mutexes[(chain_id, address)] = threading.Lock()
        return mutexes

    def _setup_direction(
        self,
        direction: TransferDirection,
        chains: dict[ChainId, Chain],
        l1: BaseChain,
        mutexes: dict[tuple[ChainId, ChecksumAddress], threading.Lock],
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
            source_chain=source_chain,
            target_chain=target_chain,
            token_checker=self._config.token_checker,
            address=self._config.account.address,
            latest_blocks={},
            config=self._config,
            web3_l1=l1.w3,
            task_pool=self._task_pool,
            claim_request_extension=claim_request_extension,
            l1_resolutions={},
            fill_mutexes=mutexes,
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
        mutexes = self._init_fill_mutexes(chains)
        chain_ids = list(chains.keys())
        if len(chain_ids) == 1:
            chain_ids.append(chain_ids[0])

        directions = permutations(chain_ids, 2)

        for direction in set(directions):
            direction = TransferDirection(direction[0], direction[1])
            self._setup_direction(direction, chains, l1, mutexes)

    def start(self) -> None:
        assert self._stopped.is_set()
        for event_processor in self._event_processors.values():
            beamer.agent.metrics.init(
                config=self._config,
                source_rpc_url=event_processor.context.source_chain.rpc_url,
                target_rpc_url=event_processor.context.target_chain.rpc_url,
            )
            event_processor.start()

        for event_monitor in self._event_monitors.values():
            event_monitor.start()
        self._stopped.clear()

    def get_directions(self) -> tuple[TransferDirection, ...]:
        return tuple(self._event_processors)

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
