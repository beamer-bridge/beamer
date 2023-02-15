import threading
import time

import brownie
import pytest
import structlog.testing

import beamer.agent
from beamer.agent import Agent
from beamer.tests.util import HTTPProxy


class _RateLimiter:
    def __init__(self, max_tokens):
        # max_tokens determines the max number of requests that we will accept
        # within 1 second.
        self._max_tokens = max_tokens
        self._tokens = max_tokens
        self._last_time = time.time()
        self._lock = threading.Lock()

    def __call__(self, url, body):
        with self._lock:
            now = time.time()
            if now - self._last_time > 1:
                # Refill the tokens.
                self._last_time = now
                self._tokens = self._max_tokens
            if self._tokens == 0:
                # Ran out of tokens, cannot accept any more requests.
                return True
            # Consume one token and accept the request.
            self._tokens -= 1
            return False


# TODO: remove this once we add support for configurable poll periods.
@pytest.fixture
def _adjust_poll_period():
    old_poll_period = beamer.agent.POLL_PERIOD
    beamer.agent.POLL_PERIOD = 0.1
    yield
    beamer.agent.POLL_PERIOD = old_poll_period


def test_rate_limiting_rpc(config, _adjust_poll_period):
    brownie.chain.mine(200)

    proxy_l2a = HTTPProxy(config.rpc_urls["l2a"])
    proxy_l2a.set_rate_limiter(_RateLimiter(2))
    proxy_l2a.start()

    config.rpc_urls["l2a"] = proxy_l2a.url()

    agent = Agent(config)
    with structlog.testing.capture_logs() as captured_logs:
        agent.start()
        time.sleep(3)
        agent.stop()
        proxy_l2a.stop()

    expected_log = dict(
        event="Entering rate limiting mode",
        log_level="debug",
        rpc=proxy_l2a.url(),
        thread="MainThread",
    )
    assert expected_log in captured_logs
