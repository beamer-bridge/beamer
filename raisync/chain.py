import json
import pathlib
import threading
import time
from typing import Any, Callable

import structlog
import web3
from eth_utils import to_checksum_address
from statemachine.exceptions import TransitionNotAllowed

import raisync.events
from raisync.events import Event, EventFetcher
from raisync.request import Request, RequestTracker
from raisync.typing import BlockNumber, ChainId


def _load_ERC20_abi() -> list[Any]:
    path = pathlib.Path(__file__)
    path = path.parent.parent.joinpath("contracts/abi/StandardToken.json")
    with path.open("rt") as fp:
        return json.load(fp)["abi"]


_ERC20_ABI = _load_ERC20_abi()

# The time we're waiting for our thread in stop(), in seconds.
# This is also the maximum time a call to stop() would block.
_STOP_TIMEOUT = 2


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
        self._thread = threading.Thread(name=self._name, target=self._thread_func)
        self._thread.start()

    def stop(self) -> None:
        self._stop = True
        self._thread.join(_STOP_TIMEOUT)

    def _thread_func(self) -> None:
        chain_id = ChainId(self._contract.web3.eth.chain_id)
        self._log.info("ContractEventMonitor started", chain_id=chain_id)
        fetcher = EventFetcher(self._contract, self._deployment_block)
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
    def __init__(self, tracker: RequestTracker, request_manager: Any, fill_manager: Any):
        # This lock protects the following objects:
        #   - self._events
        #   - self._num_syncs_done
        self._lock = threading.Lock()
        self._have_new_events = threading.Event()
        self._events: list[Event] = []
        self._tracker = tracker
        self._request_manager = request_manager
        self._fill_manager = fill_manager
        self._stop = False
        self._log = structlog.get_logger(type(self).__name__)
        # The number of times we synced with a chain:
        # 0 = we're still waiting for sync to complete for both chains
        # 1 = one of the chains was synced, waiting for the other one
        # 2 = both chains synced
        self._num_syncs_done = 0

    def mark_sync_done(self) -> None:
        with self._lock:
            assert self._num_syncs_done < 2
            self._num_syncs_done += 1

    def start(self) -> None:
        self._thread = threading.Thread(name="EventProcessor", target=self._thread_func)
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
        if isinstance(event, raisync.events.RequestCreated):
            req = Request(
                request_id=event.request_id,
                source_chain_id=event.chain_id,
                target_chain_id=event.target_chain_id,
                target_token_address=to_checksum_address(event.target_token_address),
                target_address=to_checksum_address(event.target_address),
                amount=event.amount,
            )
            self._tracker.add(req)
            return True
        elif isinstance(event, raisync.events.RequestFilled):
            request = self._tracker.get(event.request_id)
            if request is None:
                return False

            try:
                request.fill(our_fill=request.is_filled_unconfirmed)
            except TransitionNotAllowed:
                return False
            self._log.info("Request filled", _event=event)
            return True
        elif isinstance(event, raisync.events.ClaimCreated):
            request = self._tracker.get(event.request_id)
            if request is None:
                return False

            address = self._request_manager.web3.eth.default_account
            try:
                request.claim(event=event, our_claim=event.claimer == address)
            except TransitionNotAllowed:
                return False
            self._log.info("Request claimed", _event=event)
            return True
        else:
            raise RuntimeError("Unrecognized event type")

        return False

    def _process_requests(self) -> None:
        with self._lock:
            if self._num_syncs_done < 2:
                # We need to wait until we are synced with both chains.
                return

        for request in self._tracker:
            self._log.debug("Processing request", request=request)
            if request.is_pending:
                self._fill_request(request)
            elif request.is_filled and request.our_fill:
                self._claim_request(request)

    def _fill_request(self, request: Request) -> None:
        w3 = self._fill_manager.web3
        token = w3.eth.contract(abi=_ERC20_ABI, address=request.target_token_address)

        address = w3.eth.default_account
        balance = token.functions.balanceOf(address).call()
        if balance < request.amount:
            self._log.debug(
                "Unable to fill request", balance=balance, request_amount=request.amount
            )
            return

        try:
            token.functions.approve(self._fill_manager.address, request.amount).transact()
        except web3.exceptions.ContractLogicError as exc:
            self._log.error("approve failed", request_id=request.id, exc_args=exc.args)
            return

        try:
            txn_hash = self._fill_manager.functions.fillRequest(
                sourceChainId=request.source_chain_id,
                requestId=request.id,
                targetTokenAddress=request.target_token_address,
                targetReceiverAddress=request.target_address,
                amount=request.amount,
            ).transact()
        except web3.exceptions.ContractLogicError as exc:
            self._log.error("fillRequest failed", request_id=request.id, exc_args=exc.args)
            return

        w3.eth.wait_for_transaction_receipt(txn_hash)

        request.fill_unconfirmed()
        self._log.debug(
            "Filled request",
            request=request,
            txn_hash=txn_hash.hex(),
            token=token.functions.symbol().call(),
        )

    def _claim_request(self, request: Request) -> None:
        w3 = self._request_manager.web3
        stake = self._request_manager.functions.claimStake().call()

        try:
            txn_hash = self._request_manager.functions.claimRequest(request.id).transact(
                dict(value=stake)
            )
        except web3.exceptions.ContractLogicError as exc:
            self._log.error(
                "claimRequest failed", request_id=request.id, exc_args=exc.args, stake=stake
            )
            return

        w3.eth.wait_for_transaction_receipt(txn_hash)

        self._log.debug(
            "Claimed request",
            request=request,
            txn_hash=txn_hash.hex(),
        )
