import contextlib
import threading
from dataclasses import dataclass
from typing import Any, Generator

import structlog
from prometheus_client import Counter, Info, start_http_server

log = structlog.get_logger(__name__)


def init(config: Any) -> None:
    global _DATA

    if _DATA is not None:
        return

    info = Info("agent_info", "Agent information")
    info.info(
        dict(
            account=config.account.address,
            l2a_rpc_url=config.l2a_rpc_url,
            l2b_rpc_url=config.l2b_rpc_url,
        )
    )
    requests_filled = Counter(
        "requests_filled",
        "Number of requests filled on the target rollup, regardless of filler",
    )
    requests_filled_by_agent = Counter(
        "requests_filled_by_agent", "Number of requests the agent filled on the target rollup"
    )
    requests_created = Counter(
        "requests_created", "Number of requests created on the source rollup"
    )

    _DATA = _Data(
        info=info,
        requests_filled=requests_filled,
        requests_filled_by_agent=requests_filled_by_agent,
        requests_created=requests_created,
    )
    if config.prometheus_metrics_port is not None:
        log.info("Serving Prometheus metrics", port=config.prometheus_metrics_port)
        start_http_server(config.prometheus_metrics_port)


@dataclass
class _Data:
    info: Info
    requests_filled: Counter
    requests_filled_by_agent: Counter
    requests_created: Counter


_DATA: _Data = None  # type:ignore
_DATA_LOCK = threading.Lock()


@contextlib.contextmanager
def update() -> Generator[_Data, None, None]:
    with _DATA_LOCK:
        yield _DATA
