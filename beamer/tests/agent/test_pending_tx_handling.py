import json
import time

import structlog.testing
from web3.exceptions import TimeExhausted

from beamer.agent.agent import Agent
from beamer.agent.util import transact
from beamer.tests.util import HTTPProxy, alloc_accounts, make_request

_DELAY_COUNT = 0


def _post_delay_get_transaction_receipt(handler, url, post_body):
    global _DELAY_COUNT
    request_data = json.loads(post_body)
    response = handler.forward_request(url, post_body)
    if response is not None:
        # only delay this call twice
        if request_data["method"] == "eth_getTransactionReceipt" and _DELAY_COUNT < 2:
            time.sleep(3)
            data = json.loads(response.content)
            data["result"] = None
            handler.send_response(200)
            handler.end_headers()
            handler.wfile.write(json.dumps(data).encode("utf-8"))
            handler.wfile.flush()
            _DELAY_COUNT += 1
            return

        handler.complete(response)


def test_pending_tx_handling(request_manager, token, config, monkeypatch):
    # reduce the timeout to 2s, so the test can be reasonably quick
    assert transact.__defaults__ is not None  # silence mypy
    new_defaults = 2, *transact.__defaults__[1:]
    monkeypatch.setattr(transact, "__defaults__", new_defaults)

    (requester,) = alloc_accounts(1)
    make_request(request_manager, token, requester, requester, 1)

    proxy_l2a = HTTPProxy(config.rpc_urls["l2a"], _post_delay_get_transaction_receipt)
    proxy_l2a.start()

    config.rpc_urls["l2a"] = proxy_l2a.url()
    agent = Agent(config)

    with structlog.testing.capture_logs() as captured_logs:
        agent.start()
        time.sleep(4)
        agent.stop()

    proxy_l2a.stop()
    msg = "Timed out waiting for tx receipt, retrying"
    assert (
        sum(
            1
            for log in captured_logs
            if log["event"] == msg and isinstance(log["exc"], TimeExhausted)
        )
        == 2
    )
    assert sum(1 for log in captured_logs if log["event"] == "Filled request") == 1
