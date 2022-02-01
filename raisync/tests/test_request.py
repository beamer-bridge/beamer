import time

import brownie
import pytest
from brownie import accounts

import raisync.node
from raisync.tests.util import HTTPProxy, Sleeper, Timeout


def make_request(request_manager, token, requester, target_address, amount) -> int:
    token.approve(request_manager.address, amount, {"from": requester})

    total_fee = request_manager.totalFee()
    request_tx = request_manager.createRequest(
        brownie.chain.id,
        token.address,
        token.address,
        target_address,
        amount,
        {"from": requester, "value": total_fee},
    )
    return request_tx.return_value


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


@pytest.mark.parametrize("allow_unlisted_pairs", (True, False))
def test_fill_and_claim(
    request_manager, token, node, allow_unlisted_pairs, resolver, resolution_registry
):
    resolver.addRegistry(brownie.chain.id, resolution_registry.address, {"from": accounts[0]})

    target_address = accounts[1]
    request_id = make_request(request_manager, token, accounts[0], target_address, 1)

    try:
        with Sleeper(5) as sleeper:
            while (request := node.request_tracker.get(request_id)) is None:
                sleeper.sleep(0.1)
    except Timeout:
        pass

    if not allow_unlisted_pairs:
        assert request is None
        return
    else:
        assert request.id == request_id

    with Sleeper(5) as sleeper:
        while not request.is_claimed:
            sleeper.sleep(0.1)

    claims = tuple(request.iter_claims())
    assert len(claims) == 1
    assert claims[0].claimer == node.address


def test_withdraw(request_manager, token, node, resolver, resolution_registry):
    resolver.addRegistry(brownie.chain.id, resolution_registry.address, {"from": accounts[0]})

    target_address = accounts[1]
    request_id = make_request(request_manager, token, accounts[0], target_address, 1)

    with Sleeper(10) as sleeper:
        while (request := node.request_tracker.get(request_id)) is None:
            sleeper.sleep(0.1)

        while not request.is_claimed:
            sleeper.sleep(0.1)

    claim_period = request_manager.claimPeriod()
    brownie.chain.mine(timedelta=claim_period)

    with Sleeper(5) as sleeper:
        while not request.is_withdrawn:
            sleeper.sleep(0.1)
