import json
import pathlib
import threading
import time
from typing import Any

import structlog
import web3
from eth_account.signers.local import LocalAccount
from eth_utils import to_checksum_address
from web3.middleware import construct_sign_and_send_raw_middleware, geth_poa_middleware

import raisync.events
from raisync.contracts import ContractInfo, make_contracts
from raisync.events import Event, EventFetcher
from raisync.request import Request, RequestTracker
from raisync.typing import ChainId, RequestId


def _load_ERC20_abi() -> list[Any]:
    path = pathlib.Path(__file__)
    path = path.parent.parent.joinpath("contracts/abi/StandardToken.json")
    with path.open("rt") as fp:
        return json.load(fp)["abi"]


_ERC20_ABI = _load_ERC20_abi()

# The time we're waiting for our thread in stop(), in seconds.
# This is also the maximum time a call to stop() would block.
_STOP_TIMEOUT = 2


class ChainMonitor:
    def __init__(self, url: str, contracts_info: dict[str, ContractInfo], tracker: RequestTracker):
        self.url = url
        self._stop = False
        self._contracts_info = contracts_info
        self._tracker = tracker
        self._log = structlog.get_logger(type(self).__name__)

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
        self._log.info("Chain monitor started", url=self.url, chain_id=chain_id)
        request_manager = self._contracts["RequestManager"]

        deployment_block = self._contracts_info["RequestManager"].deployment_block
        fetcher = EventFetcher(request_manager, deployment_block)

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
        self._log = structlog.get_logger(type(self).__name__)

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
        self._thread_fill_monitor.join(_STOP_TIMEOUT)
        if self._thread.is_alive():
            self._thread.join(_STOP_TIMEOUT)

    def _mark_filled_single(self, request_id: RequestId) -> bool:
        request = self._tracker.get(request_id)
        if request is not None:
            request.fill()
            self._log.debug("Confirmed fill", request_id=request_id)
            return True
        return False

    def _mark_filled(self, fetcher: EventFetcher) -> set[RequestId]:
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
        self._log.debug("Fill monitor started")
        fill_manager = self._contracts["FillManager"]
        deployment_block = self._contracts_info["FillManager"].deployment_block
        fetcher = EventFetcher(fill_manager, deployment_block)

        # Mark all filled requests so that the other thread can start filling
        # (we do not want to try filling already filled requests).
        unknown = self._mark_filled(fetcher)
        self._thread.start()

        while not self._stop:
            if unknown:
                self._log.debug("Unknown request IDs", unknown=unknown)
            for request_id in unknown.copy():
                if self._mark_filled_single(request_id):
                    unknown.remove(request_id)

            unknown.update(self._mark_filled(fetcher))
            time.sleep(1)

    def _thread_func(self) -> None:
        chain_id = self._w3.eth.chain_id
        self._log.info("Request handler started", url=self.url, chain_id=chain_id)
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
            self._log.debug(
                "Unable to fulfill request", balance=balance, request_amount=request.amount
            )
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
            self._log.debug("fillRequest failed", request_id=request.id, exc_args=exc.args)
            return

        self._w3.eth.wait_for_transaction_receipt(txn_hash)

        request.fill_unconfirmed()
        self._log.debug(
            "Fulfilled request",
            request=request,
            txn_hash=txn_hash.hex(),
            token=token.functions.symbol().call(),
        )
