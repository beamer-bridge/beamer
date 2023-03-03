import functools
import threading
import time
from http import HTTPStatus

import ape
import pytest
import structlog.testing

import beamer.agent
from beamer.agent.agent import Agent
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
    old_poll_period = beamer.agent.agent.POLL_PERIOD
    beamer.agent.agent.POLL_PERIOD = 0.1
    yield
    beamer.agent.agent.POLL_PERIOD = old_poll_period


def _post_with_rate_limit(rate_limiter, handler, url, post_body):
    if rate_limiter(url, post_body):
        handler.send_response_only(HTTPStatus.TOO_MANY_REQUESTS)
        handler.end_headers()
    else:
        response = handler.forward_request(url, post_body)
        if response is not None:
            handler.complete(response)


def test_rate_limiting_rpc(config, _adjust_poll_period):
    ape.chain.mine(200)

    post_rate_limited = functools.partial(_post_with_rate_limit, _RateLimiter(2))
    proxy_l2a = HTTPProxy(config.rpc_urls["l2a"], post_rate_limited)
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
