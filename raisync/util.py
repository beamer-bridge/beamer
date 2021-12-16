import json
import logging
import os
import sys
from typing import Dict, Set, TextIO, Tuple

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


class TokenMatchChecker:
    def __init__(self, f: TextIO) -> None:
        self.pairings: Dict[Tuple[ChainId, Address], Set[Tuple[ChainId, Address]]] = {}

        data = json.load(f)

        for source_chain_id_text, source_data in data.items():
            source_chain_id = ChainId(int(source_chain_id_text))

            for source_address, target_data in source_data.items():

                for target_chain_id_text, target_address in target_data.items():

                    target_chain_id = ChainId(int(target_chain_id_text))
                    # check if already exists
                    # add symmetric case
                    self.pairings.setdefault(
                        (source_chain_id, to_canonical_address(source_address)), set()
                    ).add((target_chain_id, to_canonical_address(target_address)))

    def is_valid_pair(
        self,
        source_chain_id: ChainId,
        source_token_address: Address,
        target_chain_id: ChainId,
        target_token_address: Address,
    ) -> bool:
        target_pairs = self.pairings.get((source_chain_id, source_token_address))

        if target_pairs is not None and (target_chain_id, target_token_address) in target_pairs:
            return True

        if os.environ.get("RAISYNC_ALLOW_UNLISTED_PAIRS") is not None:
            return True

        return False
