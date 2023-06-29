import os
import sys
import threading
import time
import traceback
from concurrent.futures import Future
from typing import Callable

import requests
import structlog
from web3 import HTTPProvider, Web3
from web3._utils.empty import Empty
from web3.contract import Contract
from web3.types import Timestamp, Wei

from beamer.agent.models.claim import Claim
from beamer.agent.models.request import Request
from beamer.agent.relayer import run_relayer_for_tx
from beamer.agent.state_machine import Context, process_event
from beamer.events import Event, EventFetcher
from beamer.typing import BlockNumber, ChainId
from beamer.util import TransactionFailed, get_ERC20_abi, transact


# The time we're waiting for our thread in stop(), in seconds.
# This is also the maximum time a call to stop() would block.
_STOP_TIMEOUT = 2


_SyncDoneCallback = Callable[[], None]
_RPCStatusCallback = Callable[[bool], None]
_NewEventsCallback = Callable[[list[Event]], None]


def _wrap_thread_func(func: Callable) -> Callable:
    def wrapper(*args, **kwargs):  # type: ignore
        try:
            return func(*args, **kwargs)
        except Exception:
            traceback.print_exception(*sys.exc_info())
            os._exit(1)
            # should never be reached
            return None

    return wrapper


class EventMonitor:
    def __init__(
        self,
        web3: Web3,
        contracts: tuple[Contract, ...],
        deployment_block: BlockNumber,
        on_new_events: list[_NewEventsCallback],
        on_sync_done: list[_SyncDoneCallback],
        on_rpc_status_change: list[_RPCStatusCallback],
        poll_period: float,
        confirmation_blocks: int,
    ):
        self._web3 = web3
        self._chain_id = ChainId(self._web3.eth.chain_id)
        self._contracts = contracts
        self._deployment_block = deployment_block
        self._stop = False
        self._on_new_events = on_new_events
        self._on_sync_done = on_sync_done
        self._on_rpc_status_change = on_rpc_status_change
        self._rpc_working = True
        self._poll_period = poll_period
        self._confirmation_blocks = confirmation_blocks
        self._log = structlog.get_logger(type(self).__name__).bind(chain_id=self._chain_id)

        for contract in contracts:
            assert self._chain_id == contract.w3.eth.chain_id, f"Chain id mismatch for {contract}"

    def start(self) -> None:
        self._thread = threading.Thread(  # pylint: disable=attribute-defined-outside-init
            name=f"EventMonitor[cid={self._chain_id}]", target=_wrap_thread_func(self._thread_func)
        )
        self._thread.start()

    def stop(self) -> None:
        self._stop = True
        self._thread.join(_STOP_TIMEOUT)

    def subscribe(self, event_processor: "EventProcessor") -> None:
        self._on_new_events.append(event_processor.add_events)
        self._on_sync_done.append(event_processor.mark_sync_done)
        self._on_rpc_status_change.append(event_processor.set_rpc_working)

    def _inner_fetch(self, fetcher: EventFetcher) -> list[Event]:
        events = []
        was_working = self._rpc_working
        try:
            events.extend(fetcher.fetch())
        except requests.exceptions.ConnectionError:
            self._rpc_working = False
        else:
            self._rpc_working = True
        if was_working != self._rpc_working:
            self._call_on_rpc_status_change(self._rpc_working)
            assert isinstance(self._web3.provider, HTTPProvider)
            self._log.info(
                "RPC stopped working" if was_working else "RPC started working",
                rpc_url=self._web3.provider.endpoint_uri,
            )
        return events

    def _thread_func(self) -> None:
        self._log.info(
            "EventMonitor started",
            addresses=[c.address for c in self._contracts],
        )
        fetcher = EventFetcher(
            self._web3, self._contracts, self._deployment_block, self._confirmation_blocks
        )
        current_block = self._web3.eth.block_number
        events = []
        while fetcher.synced_block < current_block:
            events.extend(self._inner_fetch(fetcher))
        if events:
            self._call_on_new_events(events)
        self._call_on_sync_done()
        self._log.info("Sync done")
        while not self._stop:
            events = self._inner_fetch(fetcher)
            if events:
                self._call_on_new_events(events)
            time.sleep(self._poll_period)
        self._log.info("EventMonitor stopped")

    def _call_on_new_events(self, events: list[Event]) -> None:
        for on_new_events in self._on_new_events:
            on_new_events(events)

    def _call_on_sync_done(self) -> None:
        for on_sync_done in self._on_sync_done:
            on_sync_done()

    def _call_on_rpc_status_change(self, rpc_working: bool) -> None:
        for on_rpc_change in self._on_rpc_status_change:
            on_rpc_change(rpc_working)


class EventProcessor:
    # Internal wait time for checking if new events are being queued
    _WAIT_TIME = 1

    def __init__(self, context: Context):
        # This lock protects the following objects:
        #   - self._events
        #   - self._num_syncs_done
        self._lock = threading.Lock()
        self._have_new_events = threading.Event()
        self._events: list[Event] = []
        self._stop = False
        # The number of times we synced with a chain:
        # 0 = we're still waiting for sync to complete for chains
        # 1 = one of the chains was synced, if there is only one chain, sync done.
        # 2 = If there are 2 different chains, the sync is done
        self._num_syncs_done = 0
        self._context = context
        self._rpc_working = True
        self._chain_ids = {self._context.source_chain.id, self._context.target_chain.id}

    @property
    def context(self) -> Context:
        return self._context

    @property
    def _synced(self) -> bool:
        with self._lock:
            return self._num_syncs_done == len(self._chain_ids)

    def mark_sync_done(self) -> None:
        with self._lock:
            assert self._num_syncs_done < len(self._chain_ids)
            self._num_syncs_done += 1

    def start(self) -> None:
        self._thread = threading.Thread(  # pylint: disable=attribute-defined-outside-init
            name="EventProcessor", target=_wrap_thread_func(self._thread_func)
        )
        self._thread.start()

    def stop(self) -> None:
        self._stop = True
        self._thread.join(_STOP_TIMEOUT)

    def add_events(self, events: list[Event]) -> None:
        with self._lock:
            self._events.extend(events)
            self._context.logger.debug("New events", events=events)
        self._have_new_events.set()

    def set_rpc_working(self, rpc_working: bool) -> None:
        self._rpc_working = rpc_working

    def _thread_func(self) -> None:
        self._context.logger.info("EventProcessor started")

        # Wait until all past events are fetched and in the queue
        # so the agent can sync to the current state
        while not self._synced and not self._stop:
            self._have_new_events.wait(EventProcessor._WAIT_TIME)
            self._have_new_events.clear()

        while not self._stop:
            if self._have_new_events.wait(EventProcessor._WAIT_TIME):
                self._have_new_events.clear()
            if self._events:
                self._process_events()

            if not self._rpc_working:
                continue

            process_requests(self._context)
            process_claims(self._context)

        self._context.logger.info("EventProcessor stopped")

    def _process_events(self) -> None:
        iteration = 0
        created_events: list[Event] = []
        while True:
            t1 = time.time()
            with self._lock:
                events = self._events[:]

            unprocessed: list[Event] = []
            any_state_changed = False
            for event in events:
                state_changed, _ = process_event(event, self._context)
                any_state_changed |= state_changed

                if not state_changed:
                    unprocessed.append(event)

            # Return the unprocessed events to the event list.
            # Note that the event list might have been changed in the meantime
            # by one of the event monitors. Placing unprocessed events at the
            # back of the list, as opposed to the front, may avoid an extra
            # iteration over all events.
            with self._lock:
                del self._events[: len(events)]
                self._events.extend(unprocessed)

            t2 = time.time()
            self._context.logger.debug(
                "Finished iteration",
                iteration=iteration,
                any_state_changed=any_state_changed,
                num_events=len(self._events),
                duration=round((t2 - t1) * 1e3, 3),
            )
            iteration += 1
            if not any_state_changed:
                break

        # New events might be created by event handlers. If they would be
        # processed directly, there would be a chance of skipping certain states
        # in the request/claim state machines accidentally. So instead they are
        # collected and attached to the events list after the current batch of
        # events has been processed.
        with self._lock:
            self._events.extend(created_events)


def process_requests(context: Context) -> None:
    to_remove = []
    for request in context.requests:
        if request.pending.is_active:
            fill_request(request, context)

        elif request.filled.is_active:
            claim_request(request, context)

        elif request.withdrawn.is_active or request.ignored.is_active:
            active_claims = any(claim.request_id == request.id for claim in context.claims)
            if not active_claims:
                context.logger.debug("Removing request", request=request)
                to_remove.append(request.id)

    for request_id in to_remove:
        context.requests.remove(request_id)


def process_claims(context: Context) -> None:
    to_remove = []
    for claim in context.claims:
        request = context.requests.get(claim.request_id)
        # As per definition an invalid or expired request cannot be claimed
        # This gives us a chronological order. The agent should never garbage collect
        # a request which has active claims
        assert request is not None, "Active claim for non-existent request"

        if claim.ignored.is_active:
            continue

        if claim.started.is_active:
            # If the claim is not valid, we might need to send a non-fill-proof
            if not claim.valid_claim_for_request(request):
                maybe_invalidate(claim, context)
            else:
                claim.start_challenge()

            continue

        if claim.withdrawn.is_active:
            context.logger.debug("Removing withdrawn claim", claim=claim)
            to_remove.append(claim.id)
            continue

        if claim.invalidated_l1_resolved.is_active:
            maybe_withdraw(claim, context)
            continue

        # Check if claim is an honest claim. Honest claims can be ignored.
        # This only counts for claims, where the agent is not the filler
        if claim.valid_claim_for_request(request) and request.filler != context.address:
            claim.ignore()
            continue

        if claim.transaction_pending:
            continue

        if claim.claimer_winning.is_active or claim.challenger_winning.is_active:
            maybe_withdraw(claim, context)
            maybe_prove(claim, context)
            if _l1_resolution_threshold_reached(claim, context):
                maybe_resolve(claim, context)
            else:
                maybe_challenge(claim, context)

    for claim_id in to_remove:
        context.claims.remove(claim_id)


def fill_request(request: Request, context: Context) -> None:
    block = context.latest_blocks[request.target_chain_id]
    unsafe_time = request.valid_until - context.config.unsafe_fill_time
    if time.time() >= unsafe_time:
        context.logger.info("Request fill is unsafe, ignoring", request=request)
        request.ignore()
        return

    if block["timestamp"] >= request.valid_until:
        context.logger.info("Request expired, ignoring", request=request)
        request.ignore()
        return

    source_web3 = context.request_manager.w3
    source_address = source_web3.eth.default_account
    assert not isinstance(source_address, Empty)
    source_balance = source_web3.eth.get_balance(source_address)
    min_source_balance = context.config.chains[context.source_chain.name].min_source_balance

    if source_balance < min_source_balance:
        context.logger.info(
            "Not enough balance to claim, ignoring",
            request=request,
            min_source_balance=min_source_balance,
            source_balance=source_balance,
        )
        return

    target_web3 = context.fill_manager.w3
    token = target_web3.eth.contract(abi=get_ERC20_abi(), address=request.target_token_address)
    address = target_web3.eth.default_account
    balance = token.functions.balanceOf(address).call()
    if balance < request.amount:
        context.logger.info(
            "Unable to fill request", balance=balance, request_amount=request.amount
        )
        return

    allowance = context.config.token_checker.allowance(request.target_chain_id, token.address)
    if allowance is None:
        allowance = request.amount

    if allowance < request.amount:
        context.logger.info(
            "Allowance for token smaller than requested amount",
            token=token.address,
            allowance=allowance,
            request_amount=request.amount,
        )
        return
    chain_id = ChainId(target_web3.eth.chain_id)
    token_address = token.address
    mutex = context.fill_mutexes[(chain_id, token_address)]
    with mutex:
        if (
            token.functions.allowance(context.address, context.fill_manager.address).call()
            < request.amount
        ):
            func = token.functions.approve(context.fill_manager.address, allowance)
            try:
                transact(func)
            except TransactionFailed as exc:
                context.logger.error("approve failed", request_id=request.id, exc=exc)
                return

        func = context.fill_manager.functions.fillRequest(
            sourceChainId=request.source_chain_id,
            targetTokenAddress=request.target_token_address,
            targetReceiverAddress=request.target_address,
            amount=request.amount,
            nonce=request.nonce,
        )
        try:
            receipt = transact(func)
        except TransactionFailed as exc:
            context.logger.error("fillRequest failed", request_id=request.id, exc=exc)
            return

        request.try_to_fill()
        context.logger.info(
            "Filled request",
            request=request,
            txn_hash=receipt.transactionHash.hex(),  # type: ignore
            token=token.functions.symbol().call(),
        )


def claim_request(request: Request, context: Context) -> None:
    if request.filler != context.address:
        return

    block = context.latest_blocks[request.source_chain_id]
    if block["timestamp"] >= request.valid_until + context.claim_request_extension:
        context.logger.info("Request expired, ignoring", request=request)
        request.ignore()
        return

    stake = context.request_manager.functions.claimStake().call()

    func = context.request_manager.functions.claimRequest(request.id, request.fill_id)
    try:
        receipt = transact(func, value=stake)
    except TransactionFailed as exc:
        context.logger.error(
            "claimRequest failed",
            request_id=request.id,
            fill_id=request.fill_id,
            exc=exc,
            stake=stake,
        )
        return

    request.try_to_claim()
    context.logger.info(
        "Claimed request",
        request=request,
        txn_hash=receipt.transactionHash.hex(),  # type: ignore
    )


def maybe_challenge(claim: Claim, context: Context) -> bool:
    # We need to challenge if either of the following is true:
    # 1) The claim is dishonest AND claimer is winning
    # 2) Agent is claimer AND challenger is winning
    request = context.requests.get(claim.request_id)
    # As per definition an invalid or expired request cannot be claimed
    # This gives us a chronological order. The agent should never garbage collect
    # a request which has active claims
    assert request is not None, "Active claim for non-existent request"

    finalized = False

    if request.fill_timestamp is not None:
        finalized = _timestamp_is_l1_finalized(
            request.fill_timestamp, context, context.target_chain.id
        )
    elif claim.invalidation_timestamp is not None:
        finalized = _timestamp_is_l1_finalized(
            claim.invalidation_timestamp, context, context.target_chain.id
        )
    if not finalized:
        return False

    block = context.latest_blocks[request.source_chain_id]
    if block["timestamp"] >= claim.termination:
        return False
    if int(time.time()) < claim.challenge_back_off_timestamp:
        return False

    agent_winning = context.address in claim.get_winning_addresses()
    if agent_winning:
        return False

    own_challenge_stake = Wei(claim.get_challenger_stake(context.address))
    # With the condition above this means that the agent is currently losing
    agent_participating = claim.claimer == context.address or own_challenge_stake > 0

    if not agent_participating:
        if claim.challenger_winning.is_active:
            return False
        # Already challenged and has a filler, the agent won't challenge
        if request.filler is not None and claim.latest_claim_made.challenger_stake_total > 0:
            return False

    initial_claim_stake = context.request_manager.functions.claimStake().call()
    stake = claim.get_minimum_challenge_stake(initial_claim_stake)

    l1_cost = Wei(initial_claim_stake + get_l1_cost(context))

    if claim.latest_claim_made.challenger_stake_total > 0:
        stake = max(stake, Wei(l1_cost - own_challenge_stake))

    func = context.request_manager.functions.challengeClaim(claim.id)
    try:
        receipt = transact(func, value=stake)
    except TransactionFailed as exc:
        context.logger.error("challengeClaim failed", claim=claim, exc=exc, stake=stake)
        return False

    claim.transaction_pending = True

    context.logger.info(
        "Challenged claim",
        claim=claim,
        txn_hash=receipt.transactionHash.hex(),  # type: ignore
    )

    return True


def maybe_invalidate(claim: Claim, context: Context) -> None:
    request = context.requests.get(claim.request_id)
    # As per definition an invalid or expired request cannot be claimed
    # This gives us a chronological order. The agent should never garbage collect
    # a request which has active claims
    assert request is not None, "Active claim for non-existent request"

    timestamp = int(time.time())
    if timestamp < claim.challenge_back_off_timestamp:
        return

    _invalidate(request, claim, context)
    claim.start_challenge()


def _proof_ready_for_l1_relay(request: Request) -> bool:
    return (
        not request.l1_resolved.is_active
        and request.fill_tx is not None
        and request.fill_timestamp is not None
    )


def _invalidation_ready_for_l1_relay(claim: Claim) -> bool:
    return (
        not claim.invalidated_l1_resolved.is_active
        and claim.invalidation_tx is not None
        and claim.invalidation_timestamp is not None
    )


def get_l1_cost(context: Context) -> int:
    l1_gas_cost = 1_000_000  # TODO: Adapt to real price
    l1_gas_price = context.web3_l1.eth.gas_price
    l1_safety_factor = 1.25
    return int(l1_gas_cost * l1_gas_price * l1_safety_factor)


def _l1_resolution_threshold_reached(claim: Claim, context: Context) -> bool:
    limit = get_l1_cost(context)
    # Agent is claimer
    if claim.claimer == context.address:
        reward = int(claim.latest_claim_made.challenger_stake_total)
    else:
        # Agent is challenger
        reward = claim.get_challenger_stake(context.address)
        last_challenger = claim.latest_claim_made.last_challenger
        if last_challenger == context.address:
            reward -= (
                claim.latest_claim_made.challenger_stake_total
                - claim.latest_claim_made.claimer_stake
            )
    return reward > limit


def _timestamp_is_l1_finalized(
    timestamp: Timestamp, context: Context, target_chain_id: ChainId
) -> bool:
    # The internal memory should not be none because at this point
    # the ChainUpdated event must have arrived, otherwise there would be no request
    target_chain_finality = context.finality_periods[target_chain_id]
    return int(time.time()) > timestamp + target_chain_finality


def maybe_prove(claim: Claim, context: Context) -> None:
    request = context.requests.get(claim.request_id)

    assert request is not None, "Active claim for non-existent request"

    prove_tx = None
    if request.fill_tx is not None:
        prove_tx = request.fill_tx
    elif claim.invalidation_tx is not None:
        prove_tx = claim.invalidation_tx

    # mainnet: 10, goerli: 420, local: 901
    if context.target_chain.id not in (10, 420, 901):
        claim.proved_tx = prove_tx
        return

    own_challenge_stake = Wei(claim.get_challenger_stake(context.address))
    can_prove = (
        claim.claimer == context.address and claim.challenger_exists()
    ) or own_challenge_stake > 0

    if not can_prove:
        return

    if claim.proved_tx is not None or prove_tx in context.l1_resolutions:
        return

    if prove_tx is None:
        return

    future = context.task_pool.submit(
        run_relayer_for_tx,
        context.config.base_chain_rpc_url,
        context.target_chain.rpc_url,
        context.source_chain.rpc_url,
        context.config.account.key,
        prove_tx,
        True,
    )

    def on_future_done(f: Future) -> None:
        try:
            f.result()
        except Exception as ex:
            context.logger.error("Optimism prove failed", ex=ex, tx_hash=prove_tx)
        else:
            assert request is not None
            claim.proved_tx = prove_tx
            if request.fill_tx == prove_tx:
                request.fill_timestamp = Timestamp(int(time.time()))
            elif claim.invalidation_tx == prove_tx:
                claim.invalidation_timestamp = Timestamp(int(time.time()))
        finally:
            assert prove_tx is not None
            context.l1_resolutions.pop(prove_tx, None)

    future.add_done_callback(on_future_done)
    context.l1_resolutions[prove_tx] = future

    context.logger.info("Initiated Optimism prove", request=request, claim=claim, tx_hash=prove_tx)


def maybe_resolve(claim: Claim, context: Context) -> bool:
    request = context.requests.get(claim.request_id)

    assert request is not None, "Active claim for non-existent request"

    if claim.proved_tx is None or claim.proved_tx in context.l1_resolutions:
        return False

    if not _proof_ready_for_l1_relay(request) and not _invalidation_ready_for_l1_relay(claim):
        return False

    timestamp_finalized = False

    match claim.proved_tx:
        case request.fill_tx:
            assert request.fill_timestamp is not None
            timestamp_finalized = _timestamp_is_l1_finalized(
                request.fill_timestamp, context, request.target_chain_id
            )
        case claim.invalidation_tx:
            assert claim.invalidation_timestamp is not None
            timestamp_finalized = _timestamp_is_l1_finalized(
                claim.invalidation_timestamp, context, request.target_chain_id
            )
        case _:
            raise ValueError(
                f"proved transaction is neither a fill nor an invalidation: {claim.proved_tx!r}"
            )

    if not timestamp_finalized:
        return False

    if not _l1_resolution_threshold_reached(claim, context):
        return False

    future = context.task_pool.submit(
        run_relayer_for_tx,
        context.config.base_chain_rpc_url,
        context.target_chain.rpc_url,
        context.source_chain.rpc_url,
        context.config.account.key,
        claim.proved_tx,
        False,
    )

    def on_future_done(f: Future) -> None:
        try:
            f.result()
        except Exception as ex:
            context.logger.error("L1 resolution failed", ex=ex, tx_hash=claim.proved_tx)
        finally:
            assert claim.proved_tx is not None
            context.l1_resolutions.pop(claim.proved_tx, None)

    future.add_done_callback(on_future_done)
    context.l1_resolutions[claim.proved_tx] = future

    context.logger.info(
        "Initiated L1 resolution", request=request, claim=claim, tx_hash=claim.proved_tx
    )

    return True


def maybe_withdraw(claim: Claim, context: Context) -> None:
    request = context.requests.get(claim.request_id)
    # As per definition an invalid or expired request cannot be claimed
    # This gives us a chronological order. The agent should never garbage collect
    # a request which has active claims
    assert request is not None, "Active claim for non-existent request"

    block = context.latest_blocks[request.source_chain_id]
    agent_is_claimer = claim.claimer == context.address
    agent_is_challenger = claim.get_challenger_stake(context.address) > 0

    # When request is L1 resolved, the termination isn't important
    if request.l1_resolved.is_active:
        # We claimed the request
        if (
            agent_is_claimer
            and request.l1_resolution_filler == context.address
            and request.l1_resolution_fill_id == claim.fill_id
        ):
            _withdraw(claim, context)

        # Claimer cheated
        if agent_is_challenger and (
            request.l1_resolution_filler != claim.claimer
            or request.l1_resolution_fill_id != claim.fill_id
        ):
            _withdraw(claim, context)

    # Claim has a non-fill proof and the agent is challenging
    elif claim.invalidated_l1_resolved.is_active and agent_is_challenger:
        _withdraw(claim, context)

    # Otherwise check that the challenge period is over
    elif block["timestamp"] >= claim.termination:
        winning_addresses = claim.get_winning_addresses()
        if context.address in winning_addresses:
            _withdraw(claim, context)


def _withdraw(claim: Claim, context: Context) -> None:
    func = context.request_manager.functions.withdraw(claim.id)
    try:
        receipt = transact(func)
    except TransactionFailed as exc:
        # Ignore the exception when the claim has been withdrawn already
        if "Claim already withdrawn" in str(exc):
            claim.transaction_pending = True
            context.logger.warning("Claim already withdrawn", claim=claim)
            return

        context.logger.error("Withdraw failed", claim=claim, exc=exc)
        return

    claim.transaction_pending = True
    context.logger.info(
        "Withdrew", claim=claim.id, txn_hash=receipt.transactionHash.hex()  # type: ignore
    )


def _invalidate(request: Request, claim: Claim, context: Context) -> None:
    func = context.fill_manager.functions.invalidateFill(
        request.id, claim.fill_id, request.source_chain_id
    )
    try:
        receipt = transact(func)
    except TransactionFailed as exc:
        context.logger.error("Calling invalidateFill failed", claim=claim, exc=exc)
        return

    context.logger.info(
        "Invalidated fill",
        request=request.id,
        fill_id=claim.fill_id,
        claim=claim.id,
        txn_hash=receipt.transactionHash.hex(),  # type: ignore
    )
