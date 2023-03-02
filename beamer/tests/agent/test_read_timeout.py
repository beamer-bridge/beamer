import functools
import json
import time

import brownie

from beamer.agent.agent import Agent
from beamer.tests.util import HTTPProxy, alloc_accounts, make_request


def _get_delay(request_data):
    params = request_data["params"][0]
    to_block = int(params["toBlock"], 16)
    from_block = int(params["fromBlock"], 16)
    num_blocks = to_block - from_block + 1
    if num_blocks <= 200:
        return 0
    return 5


def _post_with_delay(method, delay, handler, url, post_body):
    request_data = json.loads(post_body)
    if request_data["method"] == method:
        if callable(delay):
            delay = delay(request_data)
        time.sleep(delay)

    response = handler.forward_request(url, post_body)
    if response is not None:
        handler.complete(response)


def test_read_timeout(config):
    brownie.chain.mine(200)

    delay_eth_get_logs = functools.partial(_post_with_delay, "eth_getLogs", _get_delay)

    proxy_l2a = HTTPProxy(config.rpc_urls["l2a"], delay_eth_get_logs)
    proxy_l2a.start()

    proxy_l2b = HTTPProxy(config.rpc_urls["l2b"], delay_eth_get_logs)
    proxy_l2b.start()

    config.rpc_urls["l2a"] = proxy_l2a.url()
    config.rpc_urls["l2b"] = proxy_l2b.url()

    agent = Agent(config)
    agent.start()
    time.sleep(60)
    agent.stop()
    proxy_l2a.stop()
    proxy_l2b.stop()


# This test delays the processing of eth_sendRawTransaction so that an agent
# sending a transaction gets a timeout. Previously, that would result in an
# exception that would propagate upwards within the thread, causing the agent
# to exit. With a proper fix the agent should catch the exception, continue
# running and make a clean exit after our call agent.stop().
def test_read_timeout_send_transaction(request_manager, token, config):
    delay_period = 6
    delay_eth_send_raw_tx = functools.partial(
        _post_with_delay, "eth_sendRawTransaction", delay_period
    )
    proxy_l2a = HTTPProxy(config.rpc_urls["l2a"], delay_eth_send_raw_tx)
    proxy_l2a.start()

    config.rpc_urls["l2a"] = proxy_l2a.url()

    requester, target = alloc_accounts(2)
    make_request(request_manager, token, requester, target, 1, validity_period=1800)

    agent = Agent(config)
    agent.start()
    time.sleep(delay_period)
    agent.stop()
    proxy_l2a.stop()
