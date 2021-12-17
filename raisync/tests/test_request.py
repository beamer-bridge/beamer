import time

import brownie
from brownie import accounts
import raisync.node
from raisync.tests.util import HTTPProxy


def test_request(request_manager, token, node):
    node.start()
    token.approve(request_manager.address, 1, {"from": accounts[0]})
    target_address = accounts[1]

    assert not brownie.history.of_address(request_manager.address)
    request_manager.request(1337, token.address, token.address, target_address, 1)
    txs = brownie.history.of_address(request_manager.address)
    assert len(txs) == 1
    tx = txs[0]

    # We must have 3 events, Approval, Transfer and RequestCreated.
    assert (
        len(tx.events) == 3
        and "Approval" in tx.events
        and "Transfer" in tx.events
        and "RequestCreated" in tx.events
    )

    request = tx.events["RequestCreated"]
    assert request["requestId"] == 1
    assert request["targetChainId"] == brownie.chain.id
    assert request["targetTokenAddress"] == token.address
    assert request["targetAddress"] == target_address
    assert request["amount"] == 1
    time.sleep(1)
    node.stop()


def _get_delay(request_data):
    params = request_data["params"][0]
    to_block = int(params["toBlock"], 16)
    from_block = int(params["fromBlock"], 16)
    num_blocks = to_block - from_block + 1
    if num_blocks <= 200:
        return 0
    return 5


def test_read_timeout(config):
    brownie.chain.mine(200)

    proxy_l2a = HTTPProxy(config.l2a_rpc_url)
    proxy_l2a.delay_rpc({"eth_getLogs": _get_delay})
    proxy_l2a.start()

    proxy_l2b = HTTPProxy(config.l2b_rpc_url)
    proxy_l2b.delay_rpc({"eth_getLogs": _get_delay})
    proxy_l2b.start()

    config.l2a_rpc_url = "http://%s:%s" % (
        proxy_l2a.server_address[0],
        proxy_l2a.server_address[1],
    )
    config.l2b_rpc_url = "http://%s:%s" % (
        proxy_l2b.server_address[0],
        proxy_l2b.server_address[1],
    )

    node = raisync.node.Node(config)
    node.start()
    time.sleep(60)
    node.stop()
    proxy_l2a.stop()
    proxy_l2b.stop()
