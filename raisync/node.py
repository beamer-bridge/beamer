import queue
import threading
from dataclasses import dataclass

import structlog
from eth_account.account import Account

from raisync.chain import ChainMonitor, RequestHandler
from raisync.typing import URL

log = structlog.get_logger(__name__)


@dataclass(frozen=True)
class Config:
    contracts_info: dict[str, tuple]
    account: Account
    l2a_rpc_url: URL
    l2b_rpc_url: URL


class Node:
    def __init__(self, config):
        self._config = config
        self._stopped = threading.Event()
        self._stopped.set()
        self.request_queue = queue.Queue()
        self._chain_monitor = ChainMonitor(
            config.l2a_rpc_url, config.contracts_info, self.request_queue
        )
        self._request_handler = RequestHandler(
            config.l2b_rpc_url, config.contracts_info, config.account, self.request_queue
        )

    def start(self):
        assert self._stopped.is_set()
        self._chain_monitor.start()
        self._request_handler.start()
        self._stopped.clear()

    def stop(self):
        assert not self._stopped.is_set()
        self._request_handler.stop()
        self._chain_monitor.stop()
        self._stopped.set()

    @property
    def running(self):
        return not self._stopped.is_set()

    @property
    def address(self):
        return self._config.account.address

    def wait(self):
        self._stopped.wait()
