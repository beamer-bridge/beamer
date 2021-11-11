import json
import pathlib
import queue
import threading
import time
from dataclasses import dataclass

import structlog
import web3
from eth_account import Account
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


def _load_ERC20_abi():
    path = pathlib.Path(__file__)
    path = path.parent.parent.joinpath("contracts/abi/StandardToken.json")
    with path.open("rt") as fp:
        return json.load(fp)["abi"]


_ERC20_ABI = _load_ERC20_abi()

# The time we're waiting for our thread in stop(), in seconds.
# This is also the maximum time a call to stop() would block.
_STOP_TIMEOUT = 2


class ChainMonitor:
    def __init__(self, url: str, contracts_info: dict[str, tuple], request_queue: queue.Queue):
        self.url = url
        self._stop = False
        self._contracts_info = contracts_info
        self._request_queue = request_queue

    def start(self):
        name = "ChainMonitor: %s" % self.url
        self._w3 = web3.Web3(web3.HTTPProvider(self.url))
        self._contracts = {
            name: self._w3.eth.contract(address, abi=abi)
            for name, (address, abi) in self._contracts_info.items()
        }
        self._thread = threading.Thread(name=name, target=self._thread_func)
        self._thread.start()

    def stop(self):
        self._stop = True
        self._thread.join(_STOP_TIMEOUT)

    def _thread_func(self):
        chain_id = self._w3.eth.chain_id
        log.info("Chain monitor started", url=self.url, chain_id=chain_id)
        request_manager = self._contracts["RequestManager"]
        event_filter = request_manager.events.RequestCreated.createFilter(fromBlock=0)

        while not self._stop:
            events = event_filter.get_new_entries()
            if events:
                log.debug("Got new events", chain_monitor=self, events=events)
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
                self._request_queue.put(request)
            time.sleep(1)


class RequestHandler:
    def __init__(
        self,
        url: str,
        contracts_info: dict[str, tuple],
        account: Account,
        request_queue: queue.Queue,
    ):
        self._stop = False
        self.url = url
        self._account = account
        self._contracts_info = contracts_info
        self._request_queue = request_queue

    def start(self):
        name = "RequestHandler: %s" % self.url
        self._w3 = web3.Web3(web3.HTTPProvider(self.url))
        self._w3.eth.default_account = self._account.address
        self._contracts = {
            name: self._w3.eth.contract(address, abi=abi)
            for name, (address, abi) in self._contracts_info.items()
        }
        self._thread = threading.Thread(name=name, target=self._thread_func)
        self._thread.start()

    def stop(self):
        self._stop = True
        self._thread.join(_STOP_TIMEOUT)

    def _thread_func(self):
        chain_id = self._w3.eth.chain_id
        log.info("Request handler started", url=self.url, chain_id=chain_id)
        while not self._stop:
            try:
                request = self._request_queue.get(timeout=1)
            except queue.Empty:
                pass
            else:
                log.debug("Got a request", request=request)
                self._fulfill_request(request)

    def _fulfill_request(self, request):
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
