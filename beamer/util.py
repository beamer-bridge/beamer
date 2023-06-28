import json
import logging
import pathlib
import random
import sys
import time
from collections import defaultdict
from pathlib import Path
from typing import Any, Optional, TypedDict, Union, cast

import lru
import requests
import structlog
from eth_account import Account
from eth_account.signers.local import LocalAccount
from eth_utils import to_checksum_address
from web3 import HTTPProvider, Web3
from web3.contract import ContractConstructor
from web3.contract.contract import ContractFunction
from web3.exceptions import ContractLogicError, TimeExhausted
from web3.gas_strategies.rpc import rpc_gas_price_strategy
from web3.middleware import (
    construct_sign_and_send_raw_middleware,
    construct_simple_cache_middleware,
    geth_poa_middleware,
)
from web3.types import GasPriceStrategy, TxParams, TxReceipt
from web3.utils.caching import SimpleCache

import beamer.middleware
from beamer.typing import URL, ChainId

log = structlog.get_logger(__name__)


class TransactionFailed(Exception):
    def __repr__(self) -> str:
        return "TransactionFailed(%r)" % (self.args if self.args else self.__cause__)

    def __str__(self) -> str:
        return "transaction failed: %s" % (self.args if self.args else self.__cause__)


def transact(
    func: Union[ContractConstructor, ContractFunction],
    timeout: float = 120,
    poll_latency: float = 0.1,
    attempts: int = 5,
    **kwargs: Any,
) -> TxReceipt:
    try:
        while attempts > 0:
            try:
                txn_hash = func.transact(cast(Optional[TxParams], kwargs))
            except ValueError as exc:
                attempts -= 1
                if attempts > 0:
                    log.error("transact failed, retrying", exc=exc, chain_id=func.w3.eth.chain_id)
                    period = random.randint(5, 30) / 10.0
                    time.sleep(period)
                else:
                    log.error("transact failed, giving up", exc=exc, chain_id=func.w3.eth.chain_id)
                    raise TransactionFailed("too many failed attempts") from exc
            else:
                break
    except (ContractLogicError, requests.exceptions.RequestException) as exc:
        raise TransactionFailed() from exc

    while True:
        try:
            receipt = func.w3.eth.wait_for_transaction_receipt(
                txn_hash, timeout=timeout, poll_latency=poll_latency
            )
        except TimeExhausted as exc:
            log.error(
                "Timed out waiting for tx receipt, retrying",
                exc=exc,
                chain_id=func.w3.eth.chain_id,
            )
        else:
            break

    if receipt.status == 0:  # type: ignore
        raise TransactionFailed("unknown error")
    return receipt


def setup_logging(log_level: str, log_json: bool) -> None:
    """Basic structlog setup"""

    logging.basicConfig(level=log_level, stream=sys.stdout, format="%(message)s")
    logging.logThreads = False

    logging.getLogger("web3").setLevel("INFO")
    logging.getLogger("urllib3").setLevel("INFO")

    shared_processors = [
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="%Y-%m-%d %H:%M:%S.%f"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]

    if log_json:
        processors = shared_processors + [structlog.processors.JSONRenderer()]
    else:
        processors = shared_processors + [structlog.dev.ConsoleRenderer()]

    structlog.configure(
        processors=processors,  # type: ignore
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )


def account_from_keyfile(keyfile: Path, password: str) -> LocalAccount:
    with open(keyfile, "rt") as fp:
        privkey = Account.decrypt(json.load(fp), password)
    return cast(LocalAccount, Account.from_key(privkey))


class _LRUCache(SimpleCache):
    def __init__(self, size: int):
        self._size = size
        self._data: lru.LRU[str, Any] = lru.LRU(size)

    def cache(self, key: str, value: Any) -> tuple[Any, dict[str, Any]]:
        # This is taken from SimpleCache implementation and modified to
        # work with lru.LRU.
        evicted_items = {}
        if key not in self._data:
            while len(self._data) >= self._size:
                k, v = self._data.popitem()
                evicted_items[k] = v
        self._data[key] = value
        return value, evicted_items


def make_web3(
    url: URL,
    account: Optional[LocalAccount] = None,
    gas_price_strategy: GasPriceStrategy = rpc_gas_price_strategy,
    timeout: int = 5,
) -> Web3:
    w3 = Web3(HTTPProvider(url, request_kwargs=dict(timeout=timeout)))

    # Add POA middleware for geth POA chains, no/op for other chains
    w3.middleware_onion.inject(geth_poa_middleware, layer=0)
    if account is not None:
        w3.middleware_onion.add(construct_sign_and_send_raw_middleware(account))
        w3.eth.default_account = account.address

    # Cache data of 1000 least recently used blocks.
    middleware = construct_simple_cache_middleware(_LRUCache(1000))
    w3.middleware_onion.add(middleware)

    chain_id = ChainId(w3.eth.chain_id)

    # Apply type 2 transaction middleware for ETH2 PoS chains
    # Currently Mainnet and Goerli
    if chain_id in [1, 5]:
        w3.middleware_onion.add(
            beamer.middleware.generate_middleware_with_cache(
                middleware=beamer.middleware.max_fee_setter,
                chain_id=chain_id,
            )
        )
    else:
        w3.eth.set_gas_price_strategy(gas_price_strategy)
    # Cache data of 1000 least recently used blocks, fetched via eth_getBlockByNumber.
    w3.middleware_onion.add(
        beamer.middleware.generate_middleware_with_cache(
            middleware=beamer.middleware.cache_get_block_by_number,
            chain_id=chain_id,
        )
    )

    # Handle RPCs that rate limit us.
    w3.middleware_onion.add(beamer.middleware.rate_limiter)

    return w3


def _load_ERC20_abi() -> tuple[Any, ...]:
    path = pathlib.Path(__file__)
    path = path.parent.joinpath("data/abi/StandardToken.json")
    with path.open("rt") as fp:
        return tuple(json.load(fp)["abi"])


_ERC20_ABI = _load_ERC20_abi()


def get_ERC20_abi() -> tuple[Any, ...]:
    return _ERC20_ABI


class TokenDetails(TypedDict):
    decimals: int
    symbol: str


def get_token_details(token_address: str, rpc: str) -> TokenDetails:
    token_details = defaultdict(dict)  # type: ignore[var-annotated]
    contract_abi = get_ERC20_abi()
    contract_address = to_checksum_address(token_address)
    web3 = make_web3(URL(rpc))
    contract = web3.eth.contract(address=contract_address, abi=contract_abi)
    token_details["decimals"] = contract.functions.decimals().call()
    token_details["symbol"] = contract.functions.symbol().call()
    return cast(TokenDetails, token_details)


def get_token_balance(token_address: str, wallet_address: str, rpc: str) -> int:
    contract_abi = get_ERC20_abi()
    contract_address = to_checksum_address(token_address)
    web3 = make_web3(URL(rpc))
    contract = web3.eth.contract(address=contract_address, abi=contract_abi)
    balance = contract.functions.balanceOf(wallet_address).call()
    return balance


def get_token_amount_in_decimals(amount: int, token: TokenDetails) -> int:
    return amount * 10 ** -token["decimals"]


def load_rpc_info(path: Path) -> dict[ChainId, URL]:
    info = json.loads(path.read_text())
    return {ChainId(int(k)): URL(v) for k, v in info.items()}
