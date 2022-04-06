import json
import os
import pathlib
import sys
import threading
import time
import traceback
from typing import Any, Callable, Optional, cast

import requests.exceptions
import structlog
import web3
from web3.types import TxParams

from beamer.events import Event, EventFetcher
from beamer.request import Claim, Request
from beamer.state_machine import Context, process_event
from beamer.typing import BlockNumber, ChainId

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
                state_changed = process_event(event, self._context)
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

    # TODO: pull this out of the event processor, so it can be tested independently
    def _process_requests(self) -> None:
        assert self._synced, "Not synced yet"
        self._log.info("Processing requests", num_requests=len(self._context.requests))

        to_remove = []
        for request in self._context.requests:
            self._log.debug("Processing request", request=request)

            if request.is_pending:
                fill_request(request, self._context)

            elif request.is_filled:
                claim_request(request, self._context)

            elif request.is_withdrawn:
                active_claims = any(
                    claim.request_id == request.id for claim in self._context.claims
                )
                if not active_claims:
                    self._log.debug("Removing withdrawn request", request=request)
                    to_remove.append(request.id)

        for request_id in to_remove:
            self._context.requests.remove(request_id)

    # TODO: pull this out of the event processor, so it can be tested independently
    def _process_claims(self) -> None:
        assert self._synced, "Not synced yet"
        self._log.info("Processing claims", num_claims=len(self._context.claims))

        block = self._context.request_manager.web3.eth.get_block("latest")
        latest_timestamp = block["timestamp"]

        to_remove = []
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
            assert request is not None, "Active claim for non-existent request"

            # check if claim is an honest claim. Honest claims can be ignored.
            # This only counts for claims, where the agent is not the filler
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
