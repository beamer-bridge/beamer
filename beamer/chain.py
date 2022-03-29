import json
import os
import pathlib
import sys
import threading
import time
import traceback
from dataclasses import dataclass
from typing import Any, Callable, Optional, cast

import requests.exceptions
import structlog
import web3
from hexbytes import HexBytes
from statemachine.exceptions import TransitionNotAllowed
from web3.constants import ADDRESS_ZERO
from web3.contract import Contract
from web3.types import TxParams

import beamer.events
from beamer.events import (
    ClaimEvent,
    ClaimMade,
    ClaimWithdrawn,
    DepositWithdrawn,
    Event,
    EventFetcher,
    RequestCreated,
    RequestEvent,
    RequestFilled,
)
from beamer.request import Claim, Request, Tracker
from beamer.typing import BlockNumber, ChainId, ChecksumAddress, ClaimId, RequestId
from beamer.util import TokenMatchChecker

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


class ContractEventMonitor:
    def __init__(
        self,
        name: str,
        contract: web3.contract.Contract,
        deployment_block: BlockNumber,
        on_new_events: Callable[[list[Event]], None],
        on_sync_done: Callable[[], None],
    ):
        self._name = name
        self._contract = contract
        self._deployment_block = deployment_block
        self._stop = False
        self._on_new_events = on_new_events
        self._on_sync_done = on_sync_done
        self._log = structlog.get_logger(type(self).__name__).bind(contract=name)

    def start(self) -> None:
        self._thread = threading.Thread(
            name=self._name, target=_wrap_thread_func(self._thread_func)
        )
        self._thread.start()

    def stop(self) -> None:
        self._stop = True
        self._thread.join(_STOP_TIMEOUT)

    def _thread_func(self) -> None:
        chain_id = ChainId(self._contract.web3.eth.chain_id)
        self._log.info(
            "ContractEventMonitor started", chain_id=chain_id, address=self._contract.address
        )
        fetcher = EventFetcher(self._name, self._contract, self._deployment_block)
        events = fetcher.fetch()
        if events:
            self._on_new_events(events)
        self._on_sync_done()
        self._log.info("Sync done", chain_id=chain_id)
        while not self._stop:
            events = fetcher.fetch()
            if events:
                self._on_new_events(events)
            # TODO: wait for new block instead of the sleep here
            time.sleep(1)
        self._log.info("ContractEventMonitor stopped", chain_id=chain_id)


@dataclass
class Context:
    requests: Tracker[RequestId, Request]
    claims: Tracker[ClaimId, Claim]
    request_manager: Contract
    fill_manager: Contract
    match_checker: TokenMatchChecker
    fill_wait_time: int
    address: ChecksumAddress


class EventProcessor:
    def __init__(
        self,
        request_tracker: Tracker[RequestId, Request],
        claim_tracker: Tracker[ClaimId, Claim],
        request_manager: Contract,
        fill_manager: Contract,
        match_checker: TokenMatchChecker,
        fill_wait_time: int,
        address: ChecksumAddress,
    ):
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

        self._context = Context(
            request_tracker,
            claim_tracker,
            request_manager,
            fill_manager,
            match_checker,
            fill_wait_time,
            address,
        )

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
        while not self._stop:
            if self._have_new_events.wait(1):
                self._have_new_events.clear()
                self._process_events()

            if self._synced:
                self._process_requests()
                self._process_claims()
        self._log.info("EventProcessor stopped")

    def _process_events(self) -> None:
        iteration = 0
        while True:
            with self._lock:
                events = self._events[:]

            unprocessed = []
            any_state_changed = False
            for event in events:
                state_changed = self._process_event(event)
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

            self._log.debug(
                "Finished iteration",
                iteration=iteration,
                any_state_changed=any_state_changed,
                num_events=len(self._events),
            )
            iteration += 1
            if not any_state_changed:
                break

    def _process_event(self, event: Event) -> bool:
        self._log.debug("Processing event", _event=event)
        if isinstance(event, beamer.events.RequestEvent):
            return self._process_request_event(event)
        elif isinstance(event, beamer.events.ClaimEvent):
            return self._process_claim_event(event)
        else:
            raise RuntimeError("Unrecognized event type")

    def _process_request_event(self, event: RequestEvent) -> bool:
        if isinstance(event, beamer.events.RequestCreated):
            return handle_request_created(event, self._context)

        elif isinstance(event, beamer.events.RequestFilled):
            return handle_request_filled(event, self._context)

        elif isinstance(event, beamer.events.DepositWithdrawn):
            return handle_deposit_withdrawn(event, self._context)

        else:
            raise RuntimeError("Unrecognized event type")

    def _process_claim_event(self, event: ClaimEvent) -> bool:
        if isinstance(event, beamer.events.ClaimMade):
            return handle_claim_made(event, self._context)

        elif isinstance(event, beamer.events.ClaimWithdrawn):
            return handle_claim_withdrawn(event, self._context)

        else:
            raise RuntimeError("Unrecognized event type")

    def _process_requests(self) -> None:
        assert self._synced, "Not synced yet"

        to_remove = []
        for request in self._context.requests:
            self._log.debug("Processing request", request=request)

            if request.is_pending:
                fill_request(request, self._context)

            elif request.is_filled:
                claim_request(request, self._context)

            # TODO: This should be triggered some GC event and not be done here directly
            elif request.is_withdrawn:
                self._log.debug("Removing withdrawn request", request=request)
                to_remove.append(request.id)

        # TODO skip removing for now. We must make sure that there are no claim objects anymore.
        # for request_id in to_remove:
        # note: ignored claims may be okay
        # self._request_tracker.remove(request_id)

    def _process_claims(self) -> None:
        with self._lock:
            if self._num_syncs_done < 2:
                # We need to wait until we are synced with both chains.
                return

        to_remove = []

        block = self._context.request_manager.web3.eth.get_block("latest")
        latest_timestamp = block["timestamp"]

        for claim in self._context.claims:
            self._log.debug("Processing claim", claim=claim)

            if claim.is_withdrawn:
                self._log.debug("Removing withdrawn claim", claim=claim)
                to_remove.append(claim.id)
                continue

            request = self._context.requests.get(claim.request_id)
            # As per definition an invalid or expired request cannot be claimed
            # This gives us a chronological order. The agent should never garbage collect
            # a request which has active claims
            assert request is not None, "Received a claim for non-existent request"

            # check if claim is an honest claim. Honest claims can be ignored
            if claim.valid_claim_for_request(request) and request.filler != self._context.address:
                claim.ignore()
                continue

            if claim.transaction_pending:
                continue

            if latest_timestamp >= claim.termination:
                withdraw(claim, self._context)

            if claim.is_claimer_winning or claim.is_challenger_winning:
                maybe_challenge(claim, self._context)

        for claim_id in to_remove:
            self._context.claims.remove(claim_id)


class _TransactionFailed(Exception):
    def __repr__(self) -> str:
        return "_TransactionFailed(%r)" % self.__cause__

    def __str__(self) -> str:
        return "transaction failed: %s" % self.cause()

    def cause(self) -> str:
        return str(self.__cause__)


def _transact(func: web3.contract.ContractFunction, **kwargs: Any) -> web3.types.HexBytes:
    try:
        tx_hash = func.transact(cast(Optional[TxParams], kwargs))
    except (web3.exceptions.ContractLogicError, requests.exceptions.RequestException) as exc:
        raise _TransactionFailed() from exc
    return tx_hash


def fill_request(request: Request, context: Context) -> None:
    block = context.request_manager.web3.eth.get_block("latest")
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
        _transact(func)
    except _TransactionFailed as exc:
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
        txn_hash = _transact(func)
    except _TransactionFailed as exc:
        log.error("fillRequest failed", request_id=request.id, cause=exc.cause())
        return

    w3.eth.wait_for_transaction_receipt(txn_hash)

    request.try_to_fill()
    log.debug(
        "Filled request",
        request=request,
        txn_hash=txn_hash.hex(),
        token=token.functions.symbol().call(),
    )


def claim_request(request: Request, context: Context) -> None:
    if request.filler != context.address:
        return

    w3 = context.request_manager.web3
    block = w3.eth.get_block("latest")
    if block["timestamp"] >= request.valid_until:
        log.info("Request expired, ignoring", request=request)
        request.ignore()
        return

    stake = context.request_manager.functions.claimStake().call()

    func = context.request_manager.functions.claimRequest(request.id, request.fill_id)
    try:
        txn_hash = _transact(func, value=stake)
    except _TransactionFailed as exc:
        log.error(
            "claimRequest failed",
            request_id=request.id,
            fill_id=request.fill_id,
            cause=exc.cause(),
            stake=stake,
        )
        return

    w3.eth.wait_for_transaction_receipt(txn_hash)

    request.try_to_claim()
    log.debug(
        "Claimed request",
        request=request,
        txn_hash=txn_hash.hex(),
    )


def maybe_challenge(claim: Claim, context: Context) -> bool:
    # We need to challenge if either of the following is true:
    #
    # 1) the claim is dishonest AND nobody challenged it yet
    #
    # 2) we participate in the game AND it is our turn
    if int(time.time()) < claim.challenge_back_off_timestamp:
        return False

    agent_winning = claim.get_winning_address() == context.address
    if agent_winning:
        return False

    stake = claim.get_next_challenge_stake()

    func = context.request_manager.functions.challengeClaim(claim.id)
    try:
        txn_hash = _transact(func, value=stake)
    except _TransactionFailed as exc:
        log.error("challengeClaim failed", claim=claim, cause=exc.cause(), stake=stake)
        return False

    w3 = context.request_manager.web3
    w3.eth.wait_for_transaction_receipt(txn_hash)
    claim.transaction_pending = True

    log.debug(
        "Challenged claim",
        claim=claim,
        txn_hash=txn_hash.hex(),
    )

    return True


def withdraw(claim: Claim, context: Context) -> None:
    func = context.request_manager.functions.withdraw(claim.id)
    try:
        txn_hash = _transact(func)
    except _TransactionFailed as exc:
        # Ignore the exception when the claim has been withdrawn already
        if "Claim already withdrawn" in exc.cause():
            claim.transaction_pending = True
            log.warning("Claim already withdrawn", claim=claim)
            return

        log.error("Withdraw failed", claim=claim, cause=exc.cause())
        return

    context.request_manager.web3.eth.wait_for_transaction_receipt(txn_hash)
    claim.transaction_pending = True
    log.debug("Withdrew", claim=claim.id, txn_hash=txn_hash.hex())


def handle_request_created(event: RequestCreated, context: Context) -> bool:
    # Check if the address points to a valid token
    if context.fill_manager.web3.eth.get_code(event.target_token_address) == HexBytes("0x"):
        log.info(
            "Request unfillable, invalid token contract",
            request_event=event,
            token_address=event.target_token_address,
        )
        return True

    is_valid_request = context.match_checker.is_valid_pair(
        event.chain_id,
        event.source_token_address,
        event.target_chain_id,
        event.target_token_address,
    )
    if not is_valid_request:
        log.debug("Invalid token pair in request", _event=event)
        return True

    request = Request(
        request_id=event.request_id,
        source_chain_id=event.chain_id,
        target_chain_id=event.target_chain_id,
        source_token_address=event.source_token_address,
        target_token_address=event.target_token_address,
        target_address=event.target_address,
        amount=event.amount,
        valid_until=event.valid_until,
    )
    context.requests.add(request.id, request)
    return True


def handle_request_filled(event: RequestFilled, context: Context) -> bool:
    request = context.requests.get(event.request_id)
    if request is None:
        return False

    fill_matches_request = (
        request.id == event.request_id
        and request.amount == event.amount
        and request.source_chain_id == event.source_chain_id
        and request.target_token_address == event.target_token_address
    )
    if not fill_matches_request:
        log.warn("Fill not matching request. Ignoring.", request=request, fill=event)
        return True

    try:
        request.fill(filler=event.filler, fill_id=event.fill_id)
    except TransitionNotAllowed:
        return False

    log.info("Request filled", request=request)
    return True


def handle_deposit_withdrawn(event: DepositWithdrawn, context: Context) -> bool:
    request = context.requests.get(event.request_id)
    if request is None:
        return False

    try:
        request.withdraw()
    except TransitionNotAllowed:
        return False

    log.info("Deposit withdrawn", request=request)
    return True


def handle_claim_made(event: ClaimMade, context: Context) -> bool:
    claim = context.claims.get(event.claim_id)
    request = context.requests.get(event.request_id)
    if request is None:
        return False

    if claim is None:
        challenge_back_off_timestamp = int(time.time())
        # if fill event is not fetched yet, wait `_fill_wait_time`
        # to give the target chain time to sync before challenging
        # additionally, if we are already in the challenge game, no need to back off
        if request.filler is None and event.challenger_stake == 0:
            challenge_back_off_timestamp += context.fill_wait_time
        claim = Claim(event, challenge_back_off_timestamp)
        context.claims.add(claim.id, claim)

        return True

    # this is at least the second ClaimMade event for this claim id
    assert event.challenger != ADDRESS_ZERO, "Second ClaimMade event must contain challenger"
    try:
        # Agent is not part of ongoing challenge
        if context.address not in {event.claimer, event.challenger}:
            claim.ignore(event)
        claim.challenge(event)
    except TransitionNotAllowed:
        return False

    log.info("Request claimed", request=request, claim_id=event.claim_id)
    return True


def handle_claim_withdrawn(event: ClaimWithdrawn, context: Context) -> bool:
    claim = context.claims.get(event.claim_id)
    assert claim is not None
    claim.withdraw()
    return True
