import threading
from dataclasses import dataclass

import structlog
from eth_account.signers.local import LocalAccount
from eth_typing import Address

from raisync.chain import ChainMonitor, RequestHandler, RequestTracker
from raisync.contracts import ContractInfo
from raisync.typing import URL

log = structlog.get_logger(__name__)


@dataclass(frozen=True)
class Config:
    account: LocalAccount
    l2a_contracts_info: dict[str, ContractInfo]
    l2b_contracts_info: dict[str, ContractInfo]
    l2a_rpc_url: URL
    l2b_rpc_url: URL


class Node:
    def __init__(self, config: Config):
        self._config = config
        self._stopped = threading.Event()
        self._stopped.set()
        tracker = RequestTracker()
        self._chain_monitor = ChainMonitor(config.l2a_rpc_url, config.l2a_contracts_info, tracker)
        self._request_handler = RequestHandler(
            config.l2b_rpc_url, config.l2b_contracts_info, config.account, tracker
        )

    def start(self) -> None:
        assert self._stopped.is_set()
        self._chain_monitor.start()
        self._request_handler.start()
        self._stopped.clear()

    def stop(self) -> None:
        assert not self._stopped.is_set()
        self._request_handler.stop()
        self._chain_monitor.stop()
        self._stopped.set()

    @property
    def running(self) -> bool:
        return not self._stopped.is_set()

    @property
    def address(self) -> Address:
        return self._config.account.address

    def wait(self) -> None:
        self._stopped.wait()
