import json
import logging
import sys
from pathlib import Path
from typing import Any, List, Optional, TextIO, Union, cast

import requests
import structlog
from eth_account import Account
from eth_account.signers.local import LocalAccount
from eth_utils import is_checksum_address, to_checksum_address
from web3 import HTTPProvider, Web3
from web3.contract import ContractConstructor, ContractFunction
from web3.exceptions import ContractLogicError
from web3.gas_strategies.rpc import rpc_gas_price_strategy
from web3.middleware import construct_sign_and_send_raw_middleware, geth_poa_middleware
from web3.types import GasPriceStrategy, TxParams

from beamer.typing import URL, ChainId, ChecksumAddress


class TransactionFailed(Exception):
    def __repr__(self) -> str:
        return "TransactionFailed(%r)" % self.__cause__

    def __str__(self) -> str:
        return "transaction failed: %s" % self.cause()

    def cause(self) -> str:
        return str(self.__cause__)


def transact(
    func: Union[ContractConstructor, ContractFunction],
    timeout: float = 120,
    poll_latency: float = 0.1,
    **kwargs: Any,
) -> Any:
    try:
        txn_hash = func.transact(cast(Optional[TxParams], kwargs))
    except (ContractLogicError, requests.exceptions.RequestException) as exc:
        raise TransactionFailed() from exc

    return func.web3.eth.wait_for_transaction_receipt(
        txn_hash, timeout=timeout, poll_latency=poll_latency
    )


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


def make_web3(
    url: URL, account: LocalAccount, gas_price_strategy: GasPriceStrategy = rpc_gas_price_strategy
) -> Web3:
    w3 = Web3(HTTPProvider(url, request_kwargs=dict(timeout=5)))
    w3.eth.set_gas_price_strategy(gas_price_strategy)
    # Add POA middleware for geth POA chains, no/op for other chains
    w3.middleware_onion.inject(geth_poa_middleware, layer=0)
    w3.middleware_onion.add(construct_sign_and_send_raw_middleware(account))
    w3.eth.default_account = account.address
    return w3


_Token = tuple[ChainId, ChecksumAddress]

# dictionary from base chain ID to deployed roll up IDs
SUPPORTED_CONNECTED_L2S = {
    # Mainnet
    1: frozenset({10, 42161, 288, 1088}),  # Optimism, Arbitrum, Boba, Metis
    # Rinkeby
    4: frozenset({421611, 28, 588}),  # Arbitrum, Boba, Metis
    # Goerli
    5: frozenset({420}),  # Optimism
    # Kovan
    42: frozenset({69}),  # Optimism
}


class TokenMatchChecker:
    def __init__(self, tokens: List[List[List[str]]]) -> None:
        # A mapping of tokens to equivalence classes. Each frozenset contains
        # tokens that are considered mutually equivalent.
        self._tokens: dict[_Token, frozenset[_Token]] = {}

        for token_mapping in tokens:
            equiv_class = frozenset(
                (ChainId(int(token[0])), to_checksum_address(token[1])) for token in token_mapping
            )
            l2_chain_ids = frozenset(chain_id for chain_id, _ in equiv_class)

            # check if equiv class contains chain ids from different base layers
            for connected_l2s in SUPPORTED_CONNECTED_L2S.values():
                intersection = connected_l2s.intersection(l2_chain_ids)
                if len(intersection) > 0:
                    msg = f"""All tokens' L2 chains must share the same base chain.
                     Please check {l2_chain_ids}"""
                    assert intersection == l2_chain_ids, msg

            for token in equiv_class:
                assert is_checksum_address(token[1])
                self._tokens[token] = equiv_class

    def is_valid_pair(
        self,
        source_chain_id: ChainId,
        source_token_address: ChecksumAddress,
        target_chain_id: ChainId,
        target_token_address: ChecksumAddress,
    ) -> bool:
        source_token = source_chain_id, source_token_address
        target_token = target_chain_id, target_token_address
        return target_token in self._tokens.get(source_token, frozenset())

    @staticmethod
    def from_file(f: TextIO) -> "TokenMatchChecker":
        tokens = json.load(f)
        return TokenMatchChecker(tokens)
