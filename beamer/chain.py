import json
import os
import pathlib
import sys
import threading
import time
import traceback
from typing import Any, Callable

import structlog
from web3 import Web3
from web3.contract import Contract
from web3.types import Wei

from beamer.events import Event, EventFetcher
from beamer.models.claim import Claim
from beamer.models.request import Request
from beamer.state_machine import Context, process_event
from beamer.typing import BlockNumber, ChainId
from beamer.util import TransactionFailed, transact

log = structlog.get_logger(__name__)


def _load_ERC20_abi() -> list[Any]:
    path = pathlib.Path(__file__)
    path = path.parent.joinpath("data/abi/StandardToken.json")
    with path.open("rt") as fp:
        return json.load(fp)["abi"]


_ERC20_ABI = _load_ERC20_abi()

# The time we're waiting for our thread in stop(), in seconds.
# This is also the maximum time a call to stop() would block.
_STOP_TIMEOUT = 2

POLL_PERIOD_TESTNET = 1
POLL_PERIOD_MAINNET = 5


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
        on_new_events: Callable[[list[Event]], None],
        on_sync_done: Callable[[], None],
        poll_period: int,
    ):
        self._web3 = web3
        self._chain_id = ChainId(self._web3.eth.chain_id)
        self._contracts = contracts
        self._deployment_block = deployment_block
        self._stop = False
        self._on_new_events = on_new_events
        self._on_sync_done = on_sync_done
        self._poll_period = poll_period
        self._log = structlog.get_logger(type(self).__name__).bind(chain_id=self._chain_id)

        for contract in contracts:
            assert (
                self._chain_id == contract.web3.eth.chain_id
            ), f"Chain id mismatch for {contract}"

    def start(self) -> None:
        self._thread = threading.Thread(
            name=f"EventMonitor[cid={self._chain_id}]", target=_wrap_thread_func(self._thread_func)
        )
        self._thread.start()

    def stop(self) -> None:
        self._stop = True
        self._thread.join(_STOP_TIMEOUT)

    def _thread_func(self) -> None:
        self._log.info(
            "EventMonitor started",
            addresses=[c.address for c in self._contracts],
        )

        fetcher = EventFetcher(self._web3, self._contracts, self._deployment_block)
        events = fetcher.fetch()
        if events:
            self._on_new_events(events)
        self._on_sync_done()
        self._log.info("Sync done")
        while not self._stop:
            events = fetcher.fetch()
            if events:
                self._on_new_events(events)
            time.sleep(self._poll_period)
        self._log.info("EventMonitor stopped")


class EventProcessor:
    def __init__(self, context: Context):
        # This lock protects the following objects:
        #   - self._events
        #   - self._num_syncs_done
        self._lock = threading.Lock()
        self._have_new_events = threading.Event()
        self._events: list[Event] = []
        self._stop = False
        self._log = structlog.get_logger(type(self).__name__)
        # The number of times we synced with a chain:
        # 0 = we're still waiting for sync to complete for both chains
        # 1 = one of the chains was synced, waiting for the other one
        # 2 = both chains synced
        self._num_syncs_done = 0
        self._context = context

    @property
    def _synced(self) -> bool:
        with self._lock:
            return self._num_syncs_done == 2

    def mark_sync_done(self) -> None:
        with self._lock:
            assert self._num_syncs_done < 2
            self._num_syncs_done += 1

    def start(self) -> None:
        self._thread = threading.Thread(
            name="EventProcessor", target=_wrap_thread_func(self._thread_func)
        )
        self._thread.start()

    def stop(self) -> None:
        self._stop = True
        self._thread.join(_STOP_TIMEOUT)

    def add_events(self, events: list[Event]) -> None:
        with self._lock:
            self._events.extend(events)
            self._log.debug("New events", events=events)
        self._have_new_events.set()

    def _thread_func(self) -> None:
        self._log.info("EventProcessor started")

        chain_id = self._context.web3_l1.eth.chain_id
        poll_period = POLL_PERIOD_MAINNET if chain_id == 1 else POLL_PERIOD_TESTNET

        # Wait until all past events are fetched and in the queue
        # so the agent can sync to the current state
        while not self._synced and not self._stop:
            self._have_new_events.wait(poll_period)
            self._have_new_events.clear()

        while not self._stop:
            if self._have_new_events.wait(poll_period):
                self._have_new_events.clear()
            if self._events:
                self._process_events()

            process_requests(self._context)
            process_claims(self._context)

        self._log.info("EventProcessor stopped")

    def _process_events(self) -> None:
        iteration = 0
        created_events: list[Event] = []
        while True:
            with self._lock:
                events = self._events[:]

            unprocessed: list[Event] = []
            any_state_changed = False
            for event in events:
                state_changed, new_events = process_event(event, self._context)
                any_state_changed |= state_changed

                if new_events:
                    created_events.extend(new_events)
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

            self._log.debug(
                "Finished iteration",
                iteration=iteration,
                any_state_changed=any_state_changed,
                num_events=len(self._events),
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
    log.debug("Processing requests", num_requests=len(context.requests))

    to_remove = []
    for request in context.requests:
        log.debug("Processing request", request=request)

        if request.is_pending:
            fill_request(request, context)

        elif request.is_filled:
            claim_request(request, context)

        elif request.is_withdrawn or request.is_ignored:
            active_claims = any(claim.request_id == request.id for claim in context.claims)
            if not active_claims:
                log.debug("Removing request", request=request)
                to_remove.append(request.id)

    for request_id in to_remove:
        context.requests.remove(request_id)


def process_claims(context: Context) -> None:
    log.debug("Processing claims", num_claims=len(context.claims))

    to_remove = []
    for claim in context.claims:
        log.debug("Processing claim", claim=claim)

        request = context.requests.get(claim.request_id)
        # As per definition an invalid or expired request cannot be claimed
        # This gives us a chronological order. The agent should never garbage collect
        # a request which has active claims
        assert request is not None, "Active claim for non-existent request"

        if claim.is_ignored:
            continue

        if claim.is_started:
            # If the claim is not valid, we might need to send a non-fill-proof
            if not claim.valid_claim_for_request(request):
                maybe_invalidate(claim, context)
            else:
                claim.start_challenge()

            continue

        if claim.is_withdrawn:
            log.debug("Removing withdrawn claim", claim=claim)
            to_remove.append(claim.id)
            continue

        if claim.is_invalidated_l1_resolved:
            maybe_withdraw(claim, context)
            continue

        # Check if claim is an honest claim. Honest claims can be ignored.
        # This only counts for claims, where the agent is not the filler
        if claim.valid_claim_for_request(request) and request.filler != context.address:
            claim.ignore()
            continue

        if claim.transaction_pending:
            continue

        if claim.is_claimer_winning or claim.is_challenger_winning:
            maybe_withdraw(claim, context)
            maybe_challenge(claim, context)

    for claim_id in to_remove:
        context.claims.remove(claim_id)


def fill_request(request: Request, context: Context) -> None:
    block = context.latest_blocks[request.target_chain_id]
    if block["timestamp"] >= request.valid_until:
        log.info("Request expired, ignoring", request=request)
        request.ignore()
        return

    w3 = context.fill_manager.web3
    token = w3.eth.contract(abi=_ERC20_ABI, address=request.target_token_address)
    address = w3.eth.default_account
    balance = token.functions.balanceOf(address).call()
    if balance < request.amount:
        log.debug("Unable to fill request", balance=balance, request_amount=request.amount)
        return

    func = token.functions.approve(context.fill_manager.address, request.amount)
    try:
        transact(func)
    except TransactionFailed as exc:
        log.error("approve failed", request_id=request.id, cause=exc.cause())
        return

    func = context.fill_manager.functions.fillRequest(
        requestId=request.id,
        sourceChainId=request.source_chain_id,
        targetTokenAddress=request.target_token_address,
        targetReceiverAddress=request.target_address,
        amount=request.amount,
    )
    try:
        receipt = transact(func)
    except TransactionFailed as exc:
        log.error("fillRequest failed", request_id=request.id, cause=exc.cause())
        return

    request.try_to_fill()
    log.debug(
        "Filled request",
        request=request,
        txn_hash=receipt.transactionHash.hex(),
        token=token.functions.symbol().call(),
    )


def claim_request(request: Request, context: Context) -> None:
    if request.filler != context.address:
        return

    block = context.latest_blocks[request.source_chain_id]
    if block["timestamp"] >= request.valid_until:
        log.info("Request expired, ignoring", request=request)
        request.ignore()
        return

    stake = context.request_manager.functions.claimStake().call()

    func = context.request_manager.functions.claimRequest(request.id, request.fill_id)
    try:
        receipt = transact(func, value=stake)
    except TransactionFailed as exc:
        log.error(
            "claimRequest failed",
            request_id=request.id,
            fill_id=request.fill_id,
            cause=exc.cause(),
            stake=stake,
        )
        return

    request.try_to_claim()
    log.debug(
        "Claimed request",
        request=request,
        txn_hash=receipt.transactionHash.hex(),
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
        if claim.is_challenger_winning:
            return False
        # Already challenged and has a filler, the agent won't challenge
        if request.filler is not None and claim.latest_claim_made.challenger_stake_total > 0:
            return False

    initial_claim_stake = context.request_manager.functions.claimStake().call()
    stake = claim.get_minimum_challenge_stake(initial_claim_stake)

    # TODO: have a central variable and proper L1 cost calculations
    l1_cost = Wei(initial_claim_stake + 10**15)

    if claim.latest_claim_made.challenger_stake_total > 0:
        stake = max(stake, Wei(l1_cost - own_challenge_stake))

    func = context.request_manager.functions.challengeClaim(claim.id)
    try:
        receipt = transact(func, value=stake)
    except TransactionFailed as exc:
        log.error("challengeClaim failed", claim=claim, cause=exc.cause(), stake=stake)
        return False

    claim.transaction_pending = True

    log.debug(
        "Challenged claim",
        claim=claim,
        txn_hash=receipt.transactionHash.hex(),
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
    if request.is_l1_resolved:
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
    elif claim.is_invalidated_l1_resolved and agent_is_challenger:
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
        if "Claim already withdrawn" in exc.cause():
            claim.transaction_pending = True
            log.warning("Claim already withdrawn", claim=claim)
            return

        log.error("Withdraw failed", claim=claim, cause=exc.cause())
        return

    claim.transaction_pending = True
    log.debug("Withdrew", claim=claim.id, txn_hash=receipt.transactionHash.hex())


def _invalidate(request: Request, claim: Claim, context: Context) -> None:
    func = context.fill_manager.functions.invalidateFillHash(
        request.request_hash, claim.latest_claim_made.fill_id, request.source_chain_id
    )
    try:
        receipt = transact(func)
    except TransactionFailed as exc:
        log.error("Calling invalidateFillHash failed", claim=claim, cause=exc.cause())
        return

    log.debug("Invalidated fill hash", claim=claim.id, txn_hash=receipt.transactionHash.hex())
