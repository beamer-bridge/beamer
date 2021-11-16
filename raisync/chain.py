import json
import pathlib
import threading
import time
from dataclasses import dataclass
from typing import Any, Generator

import structlog
import web3
from eth_account.signers.local import LocalAccount
from eth_typing import ChecksumAddress as Address

from raisync.typing import ChainId, RequestId, TokenAmount

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


def _make_contracts(w3: web3.Web3, contracts_info: dict) -> dict:
    return {
        name: w3.eth.contract(deployment["address"], abi=abi)
        for name, (deployment, abi) in contracts_info.items()
    }


class _EventFetcher:
    def __init__(self, event: web3.contract.ContractEvent, start_block: int):
        self._event = event
        self._next_block_number = start_block

    def fetch(self) -> list:
        block_number = self._event.web3.eth.block_number
        if block_number >= self._next_block_number:
            log.debug(
                "Fetching %s events" % self._event.event_name,
                from_block=self._next_block_number,
                to_block=block_number,
            )
            events = self._event.getLogs(fromBlock=self._next_block_number, toBlock=block_number)
            self._next_block_number = block_number + 1
            if events:
                log.debug("Got new events", events=events)
            return events
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
    def __init__(self, url: str, contracts_info: dict, pending_requests: PendingRequests):
        self.url = url
        self._stop = False
        self._contracts_info = contracts_info
        self._pending_requests = pending_requests

    def start(self) -> None:
        name = "ChainMonitor: %s" % self.url
        self._w3 = web3.Web3(web3.HTTPProvider(self.url))
        self._contracts = _make_contracts(self._w3, self._contracts_info)
        self._thread = threading.Thread(name=name, target=self._thread_func)
        self._thread.start()

    def stop(self) -> None:
        self._stop = True
        self._thread.join(_STOP_TIMEOUT)

    def _thread_func(self) -> None:
        chain_id = ChainId(self._w3.eth.chain_id)
        log.info("Chain monitor started", url=self.url, chain_id=chain_id)
        request_manager = self._contracts["RequestManager"]

        deployment_block = self._contracts_info["RequestManager"][0]["blockHeight"]
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
        contracts_info: dict,
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
        self._w3.eth.default_account = self._account.address
        self._contracts = _make_contracts(self._w3, self._contracts_info)

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
        deployment_block = self._contracts_info["FillManager"][0]["blockHeight"]
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
