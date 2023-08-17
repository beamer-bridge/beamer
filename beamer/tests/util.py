import contextlib
import json
import pathlib
import random
import socket
import string
import threading
import time
from datetime import datetime
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, List, Optional, cast

import ape
import eth_account
import requests
import web3
from ape.api.providers import Web3Provider
from ape.contracts import ContractInstance
from click.testing import CliRunner
from eth_typing import ChecksumAddress
from eth_utils import to_checksum_address
from freezegun import freeze_time
from web3.types import FilterParams

import beamer.deploy.commands
from beamer.typing import RequestId

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


def get_repo_root():
    return pathlib.Path(__file__).parents[2]


class Timeout(Exception):
    pass


class Sleeper:
    def __init__(self, timeout: float) -> None:
        self.timeout = timeout

    def __enter__(self):
        self._end = time.time() + self.timeout  # pylint: disable=attribute-defined-outside-init
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

        content_len = int(self.headers.get("Content-Length") or 0)
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
        self.allow_reuse_address = True

    def start(self) -> None:
        if self.socket._closed:
            self.socket = socket.socket(self.address_family, self.socket_type)
            self.server_bind()
            self.server_activate()

        self._thread = threading.Thread(  # pylint: disable=attribute-defined-outside-init
            target=self.serve_forever
        )
        self._thread.start()

    def stop(self) -> None:
        self.shutdown()
        self._thread.join()
        self.server_close()

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
                self._events.append(self._event.process_log(log))
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


def get_fees(request_manager):
    return (
        request_manager.minFeePPM(),
        request_manager.lpFeePPM(),
        request_manager.protocolFeePPM(),
    )


@contextlib.contextmanager
def temp_fee_data(request_manager, min_fee_ppm, lp_fee_ppm, protocol_fee_ppm):
    old_fees = get_fees(request_manager)
    request_manager.updateFees(
        min_fee_ppm,
        lp_fee_ppm,
        protocol_fee_ppm,
    )
    yield
    request_manager.updateFees(*old_fees)


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
        fees_context = temp_fee_data(request_manager, *fee_data)

    if target_chain_id is None:
        target_chain_id = ape.chain.chain_id

    with fees_context:
        with ape.accounts.test_accounts.use_sender(requester):
            total_token_amount = amount + request_manager.totalFee(
                target_chain_id, token.address, amount
            )
            if token.balanceOf(requester) < total_token_amount:
                token.mint(requester, total_token_amount - token.balanceOf(requester))

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


@contextlib.contextmanager
def jump_to_challenge_phase(proof_timestamp, finality_period):
    with freeze_time(datetime.fromtimestamp(proof_timestamp + finality_period + 1), tick=True):
        yield


def make_bytes(length: int) -> bytes:
    return bytes("".join(random.choice(string.printable) for _ in range(length)), encoding="utf-8")


def make_address() -> ChecksumAddress:
    return to_checksum_address(make_bytes(20))


class CommandFailed(Exception):
    pass


def run_command(cmd, *args):
    runner = CliRunner()
    result = runner.invoke(cmd, args, catch_exceptions=False)
    if result.exit_code:
        raise CommandFailed(result)


def write_keystore_file(path, private_key, password):
    obj = eth_account.Account.encrypt(private_key, password)
    path.write_text(json.dumps(obj))


def deploy(deployer, destdir):
    password = "test"
    keystore_file = destdir / f"{deployer.address}.json"
    write_keystore_file(keystore_file, deployer.private_key, password)
    artifacts_dir = destdir / "artifacts"
    artifacts_dir.mkdir()

    chain_id = ape.chain.chain_id
    rpc_file = destdir / "rpc.json"
    rpc_file.write_text(json.dumps({f"{chain_id}": "http://localhost:8545"}))

    root = get_repo_root()
    run_command(
        beamer.deploy.commands.deploy_base,
        "--rpc-file",
        rpc_file,
        "--keystore-file",
        keystore_file,
        "--password",
        password,
        "--abi-dir",
        f"{root}/contracts/.build/",
        "--artifacts-dir",
        artifacts_dir,
        "--commit-check",
        "no",
        f"{chain_id}",
    )

    run_command(
        beamer.deploy.commands.deploy,
        "--rpc-file",
        rpc_file,
        "--keystore-file",
        keystore_file,
        "--password",
        password,
        "--abi-dir",
        f"{root}/contracts/.build/",
        "--artifacts-dir",
        artifacts_dir,
        "--commit-check",
        "no",
        "--deploy-mintable-token",
        f"{root}/deployments/config/local/{chain_id}-ethereum.json",
    )

    artifact = f"{artifacts_dir}/{chain_id}-ethereum.deployment.json"
    return rpc_file, artifact
