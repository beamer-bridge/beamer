import functools
import itertools
import json

import ape
import structlog.testing

from requests.exceptions import HTTPError

from beamer.agent.agent import Agent
from beamer.tests.util import HTTPProxy


def _post_with_error_code(code, counter, handler, url, post_body):
    request_data = json.loads(post_body)
    if request_data["method"] == "eth_getLogs":
        # We have to send an error at least 5 times in order for the error to end
        # up in our log. This is because the default web3 HTTPProvider middleware
        # will retry up to 5 times before returning the error to us.
        count = next(counter)
        if count < 5:
            handler.send_error(code)
            handler.wfile.flush()
            return

    response = handler.forward_request(url, post_body)
    if response is not None:
        handler.complete(response)


def test_413_error(config):
    ape.chain.mine(200)

    post_with_error = functools.partial(_post_with_error_code, 413, itertools.count())

    proxy_l2a = HTTPProxy(config.chains["l2a"].rpc_url, post_with_error)
    proxy_l2a.start()

    config.chains["l2a"].rpc_url = proxy_l2a.url()

    agent = Agent(config)

    with structlog.testing.capture_logs() as captured_logs:
        agent.start()
        agent.stop()

    proxy_l2a.stop()
    assert any(
        isinstance(log.get("exc"), HTTPError) and log["exc"].response.status_code == 413
        for log in captured_logs
    )
