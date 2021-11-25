import json
import pathlib
import threading
import time
from dataclasses import dataclass
from typing import Any, Generator, Optional

import structlog
import web3
from eth_account.signers.local import LocalAccount
from eth_typing import ChecksumAddress as Address
from requests.exceptions import ReadTimeout
from web3.middleware import construct_sign_and_send_raw_middleware, geth_poa_middleware

from raisync.contracts import ContractInfo, make_contracts
from raisync.typing import BlockNumber, ChainId, RequestId, TokenAmount

log = structlog.get_logger(__name__)


@dataclass(frozen=True)
class Request:
    id: RequestId
    source_chain_id: ChainId
    target_chain_id: ChainId
    target_token_address: Address
    target_address: Address
    amount: TokenAmount


def _load_ERC20_abi() -> list[Any]:
    path = pathlib.Path(__file__)
    path = path.parent.parent.joinpath("contracts/abi/StandardToken.json")
    with path.open("rt") as fp:
        return json.load(fp)["abi"]


_ERC20_ABI = _load_ERC20_abi()

# The time we're waiting for our thread in stop(), in seconds.
# This is also the maximum time a call to stop() would block.
_STOP_TIMEOUT = 2


class _EventFetcher:
    _DEFAULT_BLOCKS = 1_000
    _MIN_BLOCKS = 2
    _MAX_BLOCKS = 100_000
    _ETH_GET_LOGS_THRESHOLD_FAST = 2
    _ETH_GET_LOGS_THRESHOLD_SLOW = 5

    def __init__(self, event: web3.contract.ContractEvent, start_block: BlockNumber):
        self._event = event
        self._next_block_number = start_block
        self._blocks_to_fetch = _EventFetcher._DEFAULT_BLOCKS

    def _fetch_range(self, from_block: BlockNumber, to_block: BlockNumber) -> Optional[list]:
        """Returns a list of events that happened in the period [from_block, to_block],
        or None if a timeout occurs."""
        log.debug(
            "Fetching %s events" % self._event.event_name, from_block=from_block, to_block=to_block
        )
        try:
            before_query = time.monotonic()
            events = self._event.getLogs(fromBlock=from_block, toBlock=to_block)
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
                log.debug("Got new events", events=events)
            duration = after_query - before_query
            if duration < _EventFetcher._ETH_GET_LOGS_THRESHOLD_FAST:
                self._blocks_to_fetch = min(_EventFetcher._MAX_BLOCKS, self._blocks_to_fetch * 2)
            elif duration > _EventFetcher._ETH_GET_LOGS_THRESHOLD_SLOW:
                self._blocks_to_fetch = max(_EventFetcher._MIN_BLOCKS, self._blocks_to_fetch // 2)
            return events

    def fetch(self) -> list:
        block_number = self._event.web3.eth.block_number
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


class PendingRequests:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._map: dict[RequestId, Request] = {}

    def add(self, request: Request) -> None:
        with self._lock:
            self._map[request.id] = request

    def remove(self, request_id: RequestId) -> None:
        with self._lock:
            del self._map[request_id]

    def __contains__(self, request_id: RequestId) -> bool:
        with self._lock:
            return request_id in self._map

    def __iter__(self) -> Any:
        def locked_iter() -> Generator:
            with self._lock:
                it = iter(self._map.values())
                while True:
                    try:
                        yield next(it)
                    except StopIteration:
                        return

        return locked_iter()


class ChainMonitor:
    def __init__(
        self, url: str, contracts_info: dict[str, ContractInfo], pending_requests: PendingRequests
    ):
        self.url = url
        self._stop = False
        self._contracts_info = contracts_info
        self._pending_requests = pending_requests

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
        fetcher = _EventFetcher(request_manager.events.RequestCreated, deployment_block)

        while not self._stop:
            events = fetcher.fetch()
            for event in events:
                args = event.args
                request = Request(
                    id=args.requestId,
                    source_chain_id=chain_id,
                    target_chain_id=args.targetChainId,
                    target_token_address=args.targetTokenAddress,
                    target_address=args.targetAddress,
                    amount=args.amount,
                )
                self._pending_requests.add(request)
            time.sleep(1)


class RequestHandler:
    def __init__(
        self,
        url: str,
        contracts_info: dict[str, ContractInfo],
        account: LocalAccount,
        pending_requests: PendingRequests,
    ):
        self._stop = False
        self.url = url
        self._account = account
        self._contracts_info = contracts_info
        self._pending_requests = pending_requests

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

    def _prune_filled_requests(self, fetcher: _EventFetcher) -> None:
        events = fetcher.fetch()
        for event in events:
            log.debug("Request filled", request_id=event.args.requestId)
            self._pending_requests.remove(event.args.requestId)

    def _fill_monitor_thread(self) -> None:
        fill_manager = self._contracts["FillManager"]
        deployment_block = self._contracts_info["FillManager"].deployment_block
        fetcher = _EventFetcher(fill_manager.events.RequestFilled, deployment_block)

        # We need to first prune all filled requests so that the other thread
        # can start filling (we do not want to try filling already filled
        # requests).
        self._prune_filled_requests(fetcher)
        self._thread.start()

        while not self._stop:
            self._prune_filled_requests(fetcher)
            time.sleep(1)

    def _thread_func(self) -> None:
        chain_id = self._w3.eth.chain_id
        log.info("Request handler started", url=self.url, chain_id=chain_id)
        while not self._stop:
            for request in self._pending_requests:
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

        txn_hash = fill_manager.functions.fillRequest(
            sourceChainId=request.source_chain_id,
            requestId=request.id,
            targetTokenAddress=request.target_token_address,
            targetReceiverAddress=request.target_address,
            amount=request.amount,
        ).transact()
        self._w3.eth.wait_for_transaction_receipt(txn_hash)

        log.debug(
            "Fulfilled request",
            request=request,
            txn_hash=txn_hash.hex(),
            token=token.functions.symbol().call(),
        )
