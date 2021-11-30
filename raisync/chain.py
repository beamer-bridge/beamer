import json
import pathlib
import threading
import time
from typing import Any, Optional

import structlog
import web3
from eth_abi.codec import ABICodec
from eth_account.signers.local import LocalAccount
from eth_utils import to_checksum_address
from eth_utils.abi import event_abi_to_log_topic
from requests.exceptions import ReadTimeout
from web3.contract import Contract, get_event_data
from web3.middleware import construct_sign_and_send_raw_middleware, geth_poa_middleware
from web3.types import ABIEvent, LogReceipt

import raisync.events
from raisync.contracts import ContractInfo, make_contracts
from raisync.events import Event
from raisync.request import Request, RequestTracker
from raisync.typing import BlockNumber, ChainId, RequestId

log = structlog.get_logger(__name__)


def _load_ERC20_abi() -> list[Any]:
    path = pathlib.Path(__file__)
    path = path.parent.parent.joinpath("contracts/abi/StandardToken.json")
    with path.open("rt") as fp:
        return json.load(fp)["abi"]


_ERC20_ABI = _load_ERC20_abi()

# The time we're waiting for our thread in stop(), in seconds.
# This is also the maximum time a call to stop() would block.
_STOP_TIMEOUT = 2


def _make_topics_to_abi(contract: web3.contract.Contract) -> dict[bytes, ABIEvent]:
    event_abis = {}
    for abi in contract.abi:
        if abi["type"] == "event":
            event_abis[event_abi_to_log_topic(abi)] = abi  # type: ignore
    return event_abis


def _decode_event(
    codec: ABICodec, log_entry: LogReceipt, event_abis: dict[bytes, ABIEvent]
) -> Event:
    topic = log_entry["topics"][0]
    event_abi = event_abis[topic]
    data = get_event_data(abi_codec=codec, event_abi=event_abi, log_entry=log_entry)
    return raisync.events.parse_event(data)


class _EventFetcher:
    _DEFAULT_BLOCKS = 1_000
    _MIN_BLOCKS = 2
    _MAX_BLOCKS = 100_000
    _ETH_GET_LOGS_THRESHOLD_FAST = 2
    _ETH_GET_LOGS_THRESHOLD_SLOW = 5

    def __init__(self, contract: Contract, start_block: BlockNumber):
        self._contract = contract
        self._next_block_number = start_block
        self._blocks_to_fetch = _EventFetcher._DEFAULT_BLOCKS
        self._chain_id = contract.web3.eth.block_number
        self._event_abis = _make_topics_to_abi(contract)

    def _fetch_range(
        self, from_block: BlockNumber, to_block: BlockNumber
    ) -> Optional[list[Event]]:
        """Returns a list of events that happened in the period [from_block, to_block],
        or None if a timeout occurs."""
        log.debug(
            "Fetching events",
            chain_id=self._chain_id,
            address=self._contract.address,
            from_block=from_block,
            to_block=to_block,
        )
        try:
            before_query = time.monotonic()
            params = dict(fromBlock=from_block, toBlock=to_block, address=self._contract.address)
            events = self._contract.web3.eth.getLogs(params)
            after_query = time.monotonic()
        except ReadTimeout:
            old = self._blocks_to_fetch
            self._blocks_to_fetch = max(_EventFetcher._MIN_BLOCKS, old // 5)
            log.debug(
                "Failed to get events in time, reducing number of blocks",
                old=old,
                new=self._blocks_to_fetch,
            )
            return None
        else:
            if events:
                codec = self._contract.web3.codec
                events = [_decode_event(codec, event, self._event_abis) for event in events]
                log.debug("Got new events", events=events)
            duration = after_query - before_query
            if duration < _EventFetcher._ETH_GET_LOGS_THRESHOLD_FAST:
                self._blocks_to_fetch = min(_EventFetcher._MAX_BLOCKS, self._blocks_to_fetch * 2)
            elif duration > _EventFetcher._ETH_GET_LOGS_THRESHOLD_SLOW:
                self._blocks_to_fetch = max(_EventFetcher._MIN_BLOCKS, self._blocks_to_fetch // 2)
            return events

    def fetch(self) -> list[Event]:
        block_number = self._contract.web3.eth.block_number
        if block_number >= self._next_block_number:
            result = []
            from_block = self._next_block_number
            while from_block <= block_number:
                to_block = min(block_number, BlockNumber(from_block + self._blocks_to_fetch))
                events = self._fetch_range(from_block, to_block)
                if events is not None:
                    result.extend(events)
                    from_block = BlockNumber(to_block + 1)

            self._next_block_number = from_block
            return result
        return []


class ChainMonitor:
    def __init__(self, url: str, contracts_info: dict[str, ContractInfo], tracker: RequestTracker):
        self.url = url
        self._stop = False
        self._contracts_info = contracts_info
        self._tracker = tracker

    def start(self) -> None:
        name = "ChainMonitor: %s" % self.url
        self._w3 = web3.Web3(web3.HTTPProvider(self.url))
        self._contracts = make_contracts(self._w3, self._contracts_info)
        self._thread = threading.Thread(name=name, target=self._thread_func)
        self._thread.start()

    def stop(self) -> None:
        self._stop = True
        self._thread.join(_STOP_TIMEOUT)

    def _thread_func(self) -> None:
        chain_id = ChainId(self._w3.eth.chain_id)
        log.info("Chain monitor started", url=self.url, chain_id=chain_id)
        request_manager = self._contracts["RequestManager"]

        deployment_block = self._contracts_info["RequestManager"].deployment_block
        fetcher = _EventFetcher(request_manager, deployment_block)

        while not self._stop:
            events = fetcher.fetch()
            for event in events:
                self._process_event(event, chain_id)
            time.sleep(1)

    def _process_event(self, event: Event, chain_id: ChainId) -> None:
        if isinstance(event, raisync.events.RequestCreated):
            request = Request(
                request_id=event.request_id,
                source_chain_id=chain_id,
                target_chain_id=event.target_chain_id,
                target_token_address=to_checksum_address(event.target_token_address),
                target_address=to_checksum_address(event.target_address),
                amount=event.amount,
            )
            self._tracker.add(request)


class RequestHandler:
    def __init__(
        self,
        url: str,
        contracts_info: dict[str, ContractInfo],
        account: LocalAccount,
        tracker: RequestTracker,
    ):
        self._stop = False
        self.url = url
        self._account = account
        self._contracts_info = contracts_info
        self._tracker = tracker

    def start(self) -> None:
        name = "RequestHandler: %s" % self.url

        self._w3 = web3.Web3(web3.HTTPProvider(self.url))

        # Add POA middleware for geth POA chains, no/op for other chains
        self._w3.middleware_onion.inject(geth_poa_middleware, layer=0)
        self._w3.middleware_onion.add(construct_sign_and_send_raw_middleware(self._account))
        self._w3.eth.default_account = self._account.address

        self._contracts = make_contracts(self._w3, self._contracts_info)

        # Create a thread, but don't start it immediately; wait until we get
        # the first batch of RequestFilled events in _fill_monitor_thread.
        self._thread = threading.Thread(name=name, target=self._thread_func)

        self._thread_fill_monitor = threading.Thread(target=self._fill_monitor_thread)
        self._thread_fill_monitor.start()

    def stop(self) -> None:
        self._stop = True
        self._thread.join(_STOP_TIMEOUT)
        self._thread_fill_monitor.join(_STOP_TIMEOUT)

    def _mark_filled_single(self, request_id: RequestId) -> bool:
        request = self._tracker.get(request_id)
        if request is not None:
            request.fill()
            log.debug("Confirmed fill", request_id=request_id)
            return True
        return False

    def _mark_filled(self, fetcher: _EventFetcher) -> set[RequestId]:
        """Fetch new Filled events and mark corresponding requests as filled.
        Return the set of request IDs that our tracker does not know about."""
        unknown: set[RequestId] = set()
        events = fetcher.fetch()
        for event in events:
            assert isinstance(event, raisync.events.RequestFilled)
            if not self._mark_filled_single(event.request_id):
                unknown.add(event.request_id)
        return unknown

    def _fill_monitor_thread(self) -> None:
        log.debug("Fill monitor started")
        fill_manager = self._contracts["FillManager"]
        deployment_block = self._contracts_info["FillManager"].deployment_block
        fetcher = _EventFetcher(fill_manager, deployment_block)

        # Mark all filled requests so that the other thread can start filling
        # (we do not want to try filling already filled requests).
        unknown = self._mark_filled(fetcher)
        self._thread.start()

        while not self._stop:
            if unknown:
                log.debug("Unknown request IDs", unknown=unknown)
            for request_id in unknown.copy():
                if self._mark_filled_single(request_id):
                    unknown.remove(request_id)

            unknown.update(self._mark_filled(fetcher))
            time.sleep(1)

    def _thread_func(self) -> None:
        chain_id = self._w3.eth.chain_id
        log.info("Request handler started", url=self.url, chain_id=chain_id)
        while not self._stop:
            for request in self._tracker:
                if request.is_pending:
                    self._fulfill_request(request)
            time.sleep(1)

    def _fulfill_request(self, request: Request) -> None:
        fill_manager = self._contracts["FillManager"]
        token = self._w3.eth.contract(abi=_ERC20_ABI, address=request.target_token_address)

        balance = token.functions.balanceOf(self._account.address).call()
        if balance < request.amount:
            log.debug("Unable to fulfill request", balance=balance, request_amount=request.amount)
            return

        token.functions.approve(fill_manager.address, request.amount).transact()

        try:
            txn_hash = fill_manager.functions.fillRequest(
                sourceChainId=request.source_chain_id,
                requestId=request.id,
                targetTokenAddress=request.target_token_address,
                targetReceiverAddress=request.target_address,
                amount=request.amount,
            ).transact()
        except web3.exceptions.ContractLogicError as exc:
            if exc.args[0].endswith("Already filled"):
                log.debug("fillRequest execution reverted: already filled", request_id=request.id)
                return
            raise exc

        self._w3.eth.wait_for_transaction_receipt(txn_hash)

        request.fill_unconfirmed()
        log.debug(
            "Fulfilled request",
            request=request,
            txn_hash=txn_hash.hex(),
            token=token.functions.symbol().call(),
        )
