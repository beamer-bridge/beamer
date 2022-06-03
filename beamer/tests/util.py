import contextlib
import json
import threading
import time
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, List, Optional

import brownie
import requests
import web3
from eth_abi.packed import encode_abi_packed
from eth_utils import keccak, to_canonical_address

from beamer.typing import RequestId


def _alloc_account():
    address = brownie.web3.geth.personal.new_account("")
    account = brownie.accounts.at(address)
    assert brownie.web3.geth.personal.unlock_account(address, "", 0)
    # transfer 1 ETH to the newly created account
    brownie.accounts[0].transfer(account, brownie.web3.toWei(1, "ether"))
    return account


def alloc_accounts(n):
    return tuple(_alloc_account() for _ in range(n))


class Timeout(Exception):
    pass


class Sleeper:
    def __init__(self, timeout: float) -> None:
        self.timeout = timeout

    def __enter__(self):
        self._end = time.time() + self.timeout
        return self

    def __exit__(self, type_, value, traceback):
        pass

    def sleep(self, interval: float) -> None:
        if time.time() > self._end:
            raise Timeout()
        time.sleep(interval)


class _HTTPRequestHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        self.server: HTTPProxy  # make mypy happy

        content_len = int(self.headers.get("Content-Length"))
        post_body = self.rfile.read(content_len)
        url = self.server.target_address
        try:
            response = requests.post(url, data=post_body)
        except requests.exceptions.ConnectionError:
            self.send_response_only(HTTPStatus.SERVICE_UNAVAILABLE)
            return

        data = json.loads(post_body)
        method = data["method"]
        delay = self.server.call_delays.get(method)
        if delay is not None:
            if callable(delay):
                delay = delay(data)
            time.sleep(delay)

        try:
            self.send_response(response.status_code)
            self.end_headers()
            self.wfile.write(response.content)
            self.wfile.flush()
        except ConnectionError:
            pass


class HTTPProxy(HTTPServer):
    def __init__(self, target_address):
        super().__init__(("", 0), _HTTPRequestHandler)
        self.target_address = target_address
        self.call_delays = {}

    def start(self) -> None:
        self._thread = threading.Thread(target=self.serve_forever)
        self._thread.start()

    def stop(self) -> None:
        self.shutdown()
        self._thread.join()

    def delay_rpc(self, call_delays):
        self.call_delays = call_delays


class EventCollector:
    def __init__(self, contract: web3.contract.Contract, event: str) -> None:
        self._address = contract.address
        contract = brownie.web3.eth.contract(address=contract.address, abi=contract.abi)
        self._event = getattr(contract.events, event)()
        self._events: List[Any] = []
        self._from_block = 0

    def next_event(self, wait_time: float = 10) -> Optional[Any]:
        """Return the next event. If no event comes within `wait_time` seconds,
        return None."""
        with Sleeper(wait_time) as sleeper:
            while not self._events:
                self._fetch_events()
                try:
                    sleeper.sleep(0.1)
                except Timeout:
                    return None
        return self._events.pop(0).args

    def _fetch_events(self) -> None:
        to_block = brownie.chain.height
        if to_block < self._from_block:
            return
        params = dict(fromBlock=self._from_block, toBlock=to_block, address=self._address)
        logs = brownie.web3.eth.get_logs(params)

        for log in logs:
            try:
                self._events.append(self._event.processLog(log))
            except web3.exceptions.MismatchedABI:
                pass
        self._from_block = to_block + 1


@contextlib.contextmanager
def earnings(w3, account):
    address = account.address
    balance_before = w3.eth.get_balance(address)

    block_before = w3.eth.block_number

    def calculate_gas_spending():
        total = 0
        for block_number in range(block_before + 1, brownie.chain.height + 1):
            block = brownie.web3.eth.get_block(block_number)
            for tx_hash in block.transactions:
                tx = brownie.web3.eth.get_transaction(tx_hash)
                tx_receipt = brownie.web3.eth.get_transaction_receipt(tx_hash)
                if tx["from"] == address:
                    total += tx.gasPrice * tx_receipt.gasUsed

        return total

    yield lambda: w3.eth.get_balance(address) + calculate_gas_spending() - balance_before


def get_fee_data(request_manager):
    return (
        request_manager.protocolFeePPM(),
        request_manager.lpFeePPM(),
        request_manager.minLpFee(),
    )


@contextlib.contextmanager
def temp_fee_data(request_manager, protocol_fee_ppm, lp_fee_ppm, min_lp_fee):
    old_fee_data = get_fee_data(request_manager)
    request_manager.updateFeeData(protocol_fee_ppm, lp_fee_ppm, min_lp_fee)
    yield
    request_manager.updateFeeData(*old_fee_data)


def make_request(
    request_manager,
    token,
    requester,
    target_address,
    amount,
    validity_period=3600,
    target_chain_id=None,
    fee_data=(0, 0, 0),
) -> RequestId:
    fees_context: Any  # make mypy happy
    if fee_data == "standard":
        fees_context = contextlib.nullcontext()
    else:
        fees_context = temp_fee_data(request_manager, *fee_data)

    with fees_context:
        total_token_amount = amount + request_manager.totalFee(amount)
        if token.balanceOf(requester) < total_token_amount:
            token.mint(requester, total_token_amount, {"from": requester})

        token.approve(request_manager.address, total_token_amount, {"from": requester})

        if target_chain_id is None:
            target_chain_id = brownie.chain.id

        request_tx = request_manager.createRequest(
            target_chain_id,
            token.address,
            token.address,
            target_address,
            amount,
            validity_period,
            {"from": requester},
        )
    return request_tx.return_value


def create_request_hash(
    request_id, source_chain_id, target_chain_id, target_token_address, receiver_address, amount
):
    return keccak(
        encode_abi_packed(
            ["uint256", "uint256", "uint256", "address", "address", "uint256"],
            [
                request_id,
                source_chain_id,
                target_chain_id,
                to_canonical_address(target_token_address),
                to_canonical_address(receiver_address),
                amount,
            ],
        )
    )


def create_fill_hash(
    request_id,
    source_chain_id,
    target_chain_id,
    target_token_address,
    receiver_address,
    amount,
    fill_id,
):
    return create_fill_hash_from_request_hash(
        create_request_hash(
            request_id,
            source_chain_id,
            target_chain_id,
            target_token_address,
            receiver_address,
            amount,
        ),
        fill_id,
    )


def create_fill_hash_from_request_hash(
    request_hash,
    fill_id,
):
    return keccak(
        encode_abi_packed(
            ["bytes32", "bytes32"],
            [
                request_hash,
                fill_id,
            ],
        )
    )
