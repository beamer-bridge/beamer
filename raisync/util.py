import json
import logging
import os
import sys
from typing import TextIO

import structlog
from eth_utils import to_canonical_address

from raisync.typing import Address, ChainId


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


_Token = tuple[ChainId, Address]


class TokenMatchChecker:
    def __init__(self, f: TextIO) -> None:
        # A mapping of tokens to equivalence classes. Each frozenset contains
        # tokens that are considered mutually equivalent.
        self._tokens: dict[_Token, frozenset[_Token]] = {}

        data = json.load(f)
        for equiv_class in data:
            equiv_class = frozenset(
                (chain_id, to_canonical_address(address)) for (chain_id, address) in equiv_class
            )
            for token in equiv_class:
                self._tokens[token] = equiv_class

    def is_valid_pair(
        self,
        source_chain_id: ChainId,
        source_token_address: Address,
        target_chain_id: ChainId,
        target_token_address: Address,
    ) -> bool:
        if os.environ.get("RAISYNC_ALLOW_UNLISTED_PAIRS") is not None:
            return True

        source_token = source_chain_id, source_token_address
        target_token = target_chain_id, target_token_address
        return target_token in self._tokens.get(source_token, frozenset())
