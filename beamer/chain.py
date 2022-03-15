import json
import os
import pathlib
import sys
import threading
import time
import traceback
from typing import Any, Callable

import structlog
import web3
from hexbytes import HexBytes
from statemachine.exceptions import TransitionNotAllowed
from web3.contract import Contract
from web3.types import Wei

import beamer.events
from beamer.events import ClaimMade, Event, EventFetcher
from beamer.request import Claim, Request, RequestData, Tracker
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
        self._request_tracker = request_tracker
        self._claim_tracker = claim_tracker
        self._request_manager = request_manager
        self._fill_manager = fill_manager
        self._match_checker = match_checker
        self._stop = False
        self._log = structlog.get_logger(type(self).__name__)
        self._address = address
        # The number of times we synced with a chain:
        # 0 = we're still waiting for sync to complete for both chains
        # 1 = one of the chains was synced, waiting for the other one
        # 2 = both chains synced
        self._num_syncs_done = 0

        self._fill_wait_time = fill_wait_time

        if not self._fill_manager.functions.allowedLPs(self._address).call():
            raise RuntimeError("Agent address is not whitelisted")

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
        if isinstance(event, beamer.events.RequestCreated):
            # Check if the address points to a valid token
            if self._fill_manager.web3.eth.get_code(event.target_token_address) == HexBytes("0x"):
                self._log.info(
                    "Request unfillable, invalid token contract",
                    request_event=event,
                    token_address=event.target_token_address,
                )
                return False

            is_valid_request = self._match_checker.is_valid_pair(
                event.chain_id,
                event.source_token_address,
                event.target_chain_id,
                event.target_token_address,
            )
            if not is_valid_request:
                self._log.debug("Invalid token pair in request", _event=event)
                return False

            data = self._request_manager.functions.requests(event.request_id).call()
            request_data = RequestData.from_chain_data(data)

            req = Request(
                request_id=event.request_id,
                source_chain_id=event.chain_id,
                target_chain_id=request_data.targetChainId,
                source_token_address=request_data.sourceTokenAddress,
                target_token_address=request_data.targetTokenAddress,
                target_address=request_data.targetAddress,
                amount=request_data.amount,
                valid_until=request_data.validUntil,
            )
            self._request_tracker.add(req.id, req)
            return True

        elif isinstance(event, beamer.events.RequestFilled):
            request = self._request_tracker.get(event.request_id)
            if request is None:
                return False

            fill_matches_request = (
                request.id == event.request_id
                and request.amount == event.amount
                and request.source_chain_id == event.source_chain_id
                and request.target_token_address == event.target_token_address
            )
            if not fill_matches_request:
                self._log.warn("Fill not matching request. Ignoring.", request=request, fill=event)
                return True

            try:
                request.fill(filler=event.filler, fill_id=event.fill_id)
            except TransitionNotAllowed:
                return False
            self._log.info("Request filled", request=request)
            return True

        elif isinstance(event, beamer.events.ClaimMade):
            request = self._request_tracker.get(event.request_id)
            if request is None:
                return False

            try:
                request.claim(event=event, fill_wait_time=self._fill_wait_time)

                claim = Claim(event.claim_id, request.id)
                self._claim_tracker.add(claim.claim_id, claim)
            except TransitionNotAllowed:
                return False
            self._log.info("Request claimed", request=request, claim_id=event.claim_id)
            return True

        elif isinstance(event, beamer.events.ClaimWithdrawn):
            request = self._request_tracker.get(event.request_id)
            if request is None:
                return False

            try:
                request.withdraw()
                # TODO: handle claim
            except TransitionNotAllowed:
                return False
            self._log.info("Claim withdrawn", request=request)
            return True
        else:
            raise RuntimeError("Unrecognized event type")

    def _process_requests(self) -> None:
        with self._lock:
            if self._num_syncs_done < 2:
                # We need to wait until we are synced with both chains.
                return

        to_remove = []
        for request in self._request_tracker:
            self._log.debug("Processing request", request=request)
            if request.is_pending:
                fill_request(request, self._request_manager, self._fill_manager)
            elif request.is_filled and request.filler == self._address:
                claim_request(request, self._request_manager)
            elif request.is_claimed:
                check_claims(request, self._request_manager, self._address)
            elif request.is_unfillable:
                self._log.debug("Removing unfillable request", request=request)
                to_remove.append(request.id)
            elif request.is_withdrawn:
                self._log.debug("Removing withdrawn request", request=request)
                to_remove.append(request.id)

        for request_id in to_remove:
            self._request_tracker.remove(request_id)

    def _process_claims(self) -> None:
        with self._lock:
            if self._num_syncs_done < 2:
                # We need to wait until we are synced with both chains.
                return

        for claim in self._claim_tracker:
            self._log.debug("Processing claim", claim=claim)

            request = self._request_tracker.get(claim.request_id)
            if request is None:
                continue

            maybe_challenge(
                request,
                claim,
                request.get_challenge_back_off_timestamp(claim.claim_id),
                self._request_manager,
                self._address,
            )

            if claim.claimer == self._address:
                try_withdraw(claim, self._request_manager)


def fill_request(request: Request, request_manager: Contract, fill_manager: Contract) -> None:
    block = request_manager.web3.eth.get_block("latest")
    if block["timestamp"] >= request.valid_until:
        log.info("Request expired, ignoring", request=request)
        request.ignore()
        return

    w3 = fill_manager.web3
    token = w3.eth.contract(abi=_ERC20_ABI, address=request.target_token_address)
    address = w3.eth.default_account
    balance = token.functions.balanceOf(address).call()
    if balance < request.amount:
        log.debug("Unable to fill request", balance=balance, request_amount=request.amount)
        return

    try:
        token.functions.approve(fill_manager.address, request.amount).transact()
    except web3.exceptions.ContractLogicError as exc:
        log.error("approve failed", request_id=request.id, exc_args=exc.args)
        return

    try:
        txn_hash = fill_manager.functions.fillRequest(
            requestId=request.id,
            sourceChainId=request.source_chain_id,
            targetTokenAddress=request.target_token_address,
            targetReceiverAddress=request.target_address,
            amount=request.amount,
        ).transact()
    except web3.exceptions.ContractLogicError as exc:
        log.error("fillRequest failed", request_id=request.id, exc_args=exc.args)
        return

    w3.eth.wait_for_transaction_receipt(txn_hash)

    request.fill_unconfirmed()
    log.debug(
        "Filled request",
        request=request,
        txn_hash=txn_hash.hex(),
        token=token.functions.symbol().call(),
    )


def claim_request(request: Request, request_manager: Contract) -> None:
    w3 = request_manager.web3
    stake = request_manager.functions.claimStake().call()

    try:
        txn_hash = request_manager.functions.claimRequest(request.id, request.fill_id).transact(
            dict(value=stake)
        )
    except web3.exceptions.ContractLogicError as exc:
        log.error(
            "claimRequest failed",
            request_id=request.id,
            fill_id=request.fill_id,
            exc_args=exc.args,
            stake=stake,
        )
        return

    w3.eth.wait_for_transaction_receipt(txn_hash)

    request.claim_unconfirmed()
    log.debug(
        "Claimed request",
        request=request,
        txn_hash=txn_hash.hex(),
    )


def check_claims(
    request: Request, request_manager: Contract, own_address: ChecksumAddress
) -> None:
    for claim in request.iter_claims():
        maybe_challenge(
            request,
            claim,
            request.get_challenge_back_off_timestamp(claim.claim_id),
            request_manager,
            own_address,
        )

        if claim.claimer == own_address:
            try_withdraw(claim, request_manager)


def compute_challenge_stake(claim: ClaimMade) -> Wei:  # pylint:disable=no-self-use
    stake_increase = 1
    if claim.challenger_stake == 0:
        # we challenge with enough stake for L1 resolution
        stake_increase = 10 ** 15
    return Wei(max(claim.claimer_stake, claim.challenger_stake) + stake_increase)


def maybe_challenge(
    request: Request,
    claim: ClaimMade,
    back_off_until: int,
    request_manager: Contract,
    own_address: ChecksumAddress,
) -> bool:
    # We need to challenge if either of the following is true:
    #
    # 1) the claim is dishonest AND nobody challenged it yet
    #
    # 2) we participate in the game AND it is our turn

    if int(time.time()) < back_off_until:
        return False

    unchallenged = claim.challenger_stake == 0
    own_claim = claim.claimer == own_address
    dishonest_claim = claim.claimer != request.filler or claim.fill_id != request.fill_id

    our_turn = (
        claim.challenger == own_address and claim.claimer_stake > claim.challenger_stake
    ) or (own_claim and claim.claimer_stake < claim.challenger_stake)

    should_challenge = dishonest_claim and unchallenged and not own_claim or our_turn
    if not should_challenge:
        return False

    stake = compute_challenge_stake(claim)

    try:
        txn_hash = request_manager.functions.challengeClaim(claim.claim_id).transact(
            dict(value=stake)
        )
    except web3.exceptions.ContractLogicError as exc:
        log.error("challengeClaim failed", claim=claim, exc_args=exc.args, stake=stake)
        return False

    w3 = request_manager.web3
    w3.eth.wait_for_transaction_receipt(txn_hash)

    log.debug(
        "Challenged claim",
        claim=claim,
        txn_hash=txn_hash.hex(),
    )

    return True


def try_withdraw(claim: ClaimMade, request_manager: Contract) -> None:
    w3 = request_manager.web3
    # check whether the claim period expired
    # TODO: avoid making these calls every time
    block = w3.eth.get_block(w3.eth.block_number)
    if block["timestamp"] < claim.termination:
        return

    try:
        txn_hash = request_manager.functions.withdraw(claim.claim_id).transact()
    except web3.exceptions.ContractLogicError as exc:
        log.error("withdraw failed", claim, exc_args=exc.args)
        return

    w3.eth.wait_for_transaction_receipt(txn_hash)
    log.debug("Withdrew", claim=claim, txn_hash=txn_hash.hex())
