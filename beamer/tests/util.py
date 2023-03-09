import contextlib
import threading
import time
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, List, Optional, cast

import ape
import requests
import web3
from ape.api.providers import Web3Provider
from ape.contracts import ContractInstance
from eth_abi.packed import encode_packed
from eth_utils import keccak, to_canonical_address
from web3.types import FilterParams

from beamer.agent.typing import RequestId
from beamer.tests.constants import RM_T_FIELD_TRANSFER_LIMIT

FUNDER = ape.accounts.test_accounts[0]


def _alloc_account():
    account = ape.accounts.test_accounts.generate_test_account()
    # transfer 1 ETH to the newly created account
    FUNDER.transfer(account, ape.convert("1 ether", int))
    return account


def alloc_accounts(n):
    return tuple(_alloc_account() for _ in range(n))


def alloc_whitelisted_accounts(n, contracts):
    accounts = tuple(_alloc_account() for _ in range(n))
    for account in accounts:
        for contract in contracts:
            contract.addAllowedLp(account)
    return accounts


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
        self.server.do_post(self, url, post_body)

    def forward_request(self, url, post_body):
        try:
            return requests.post(url, data=post_body)
        except requests.exceptions.ConnectionError:
            self.send_response_only(HTTPStatus.SERVICE_UNAVAILABLE)
            self.end_headers()
        return None

    def complete(self, response):
        try:
            self.send_response(response.status_code)
            self.end_headers()
            self.wfile.write(response.content)
            self.wfile.flush()
        except ConnectionError:
            pass


class HTTPProxy(HTTPServer):
    def __init__(self, target_address, do_post):
        super().__init__(("", 0), _HTTPRequestHandler)
        self.target_address = target_address
        assert callable(do_post)
        self.do_post = do_post

    def start(self) -> None:
        self._thread = threading.Thread(target=self.serve_forever)
        self._thread.start()

    def stop(self) -> None:
        self.shutdown()
        self._thread.join()

    def url(self):
        host, port = self.server_address
        if not isinstance(host, str):
            host = host.decode()
        return "http://%s:%s" % (host, port)


class EventCollector:
    def __init__(self, contract: ContractInstance, event: str) -> None:
        self._address = contract.address
        self._provider = cast(Web3Provider, ape.chain.provider)
        w3_contract = self._provider.web3.eth.contract(
            address=contract.address, abi=[abi.dict() for abi in contract.contract_type.abi]
        )
        self._event = getattr(w3_contract.events, event)()
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
        to_block = ape.chain.blocks.height
        if to_block < self._from_block:
            return
        params = dict(fromBlock=self._from_block, toBlock=to_block, address=self._address)
        filter_params = cast(FilterParams, params)
        logs = self._provider.web3.eth.get_logs(filter_params)

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
    provider = cast(Web3Provider, ape.chain.provider)

    def calculate_gas_spending():
        total = 0
        for block_number in range(block_before + 1, ape.chain.blocks.height + 1):
            block = ape.chain.blocks[block_number]
            for tx in block.transactions:
                receipt = provider.get_receipt(tx.txn_hash.hex())
                if tx.sender == address:
                    total += receipt.total_fees_paid

        return total

    yield lambda: w3.eth.get_balance(address) + calculate_gas_spending() - balance_before


# The function updates the token values partially whatever variable is in the params dictionary
# This function works similar to adding a parameters dict to a transaction in web3.py
def update_token(request_manager, token, params, *args, **kwargs):
    token_data = list(request_manager.tokens(token.address))
    fields = ["transfer_limit", "eth_in_token", "lp_fee_ppm", "protocol_fee_ppm"]
    new_token_data = tuple(params.get(key, token_data[i]) for i, key in enumerate(fields))
    request_manager.updateToken(token.address, *new_token_data, *args, **kwargs)


def get_token_data(request_manager, token_address):
    return request_manager.tokens(token_address)


@contextlib.contextmanager
def temp_fee_data(request_manager, token, eth_in_token, lp_fee_ppm, protocol_fee_ppm):
    old_token_data = get_token_data(request_manager, token)
    request_manager.updateToken(
        token.address,
        old_token_data[RM_T_FIELD_TRANSFER_LIMIT],
        eth_in_token,
        lp_fee_ppm,
        protocol_fee_ppm,
    )
    yield
    # the last element of token data is collectedProtocolFees which is not part of the update
    request_manager.updateToken(token.address, *old_token_data[:-1])


def make_request(
    request_manager,
    token,
    requester,
    target_address,
    amount,
    validity_period=1800,
    target_chain_id=None,
    fee_data=(0, 0, 0),
) -> RequestId:
    fees_context: Any  # make mypy happy
    if fee_data == "standard":
        fees_context = contextlib.nullcontext()
    else:
        fees_context = temp_fee_data(request_manager, token, *fee_data)

    if target_chain_id is None:
        target_chain_id = ape.chain.chain_id

    with fees_context:
        with ape.accounts.test_accounts.use_sender(requester):
            total_token_amount = amount + request_manager.totalFee(
                target_chain_id, token.address, amount
            )
            if token.balanceOf(requester) < total_token_amount:
                token.mint(requester, total_token_amount)

            token.approve(request_manager.address, total_token_amount)

            request_tx = request_manager.createRequest(
                target_chain_id,
                token.address,
                token.address,
                target_address,
                amount,
                validity_period,
            )
    return RequestId(request_tx.return_value)


def create_request_id(
    source_chain_id, target_chain_id, target_token_address, receiver_address, amount, nonce
):
    return keccak(
        encode_packed(
            ["uint256", "uint256", "address", "address", "uint256", "uint96"],
            [
                source_chain_id,
                target_chain_id,
                to_canonical_address(target_token_address),
                to_canonical_address(receiver_address),
                amount,
                nonce,
            ],
        )
    )
