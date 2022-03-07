import time

import brownie
import pytest
from brownie import ZERO_ADDRESS, accounts
from eth_utils import to_checksum_address
from web3.types import Wei

from beamer.agent import Node
from beamer.events import ClaimMade
from beamer.request import Request
from beamer.tests.util import HTTPProxy, Sleeper, Timeout, make_request
from beamer.typing import ClaimId, FillId, RequestId, Termination, TokenAmount


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

    node = Node(config)
    node.start()
    time.sleep(60)
    node.stop()
    proxy_l2a.stop()
    proxy_l2b.stop()


def test_challenge_own_claim(config, request_manager, token):
    node = Node(config)
    node_address = to_checksum_address(node.address)
    claim_stake = request_manager.claimStake()
    request = Request(
        RequestId(100),
        brownie.chain.id,
        brownie.chain.id,
        token.address,
        token.address,
        node_address,
        TokenAmount(1),
        Termination(1700000000),
    )

    claim_event = ClaimMade(
        brownie.chain.id,
        ClaimId(1),
        request.id,
        FillId(0),
        node_address,
        claim_stake,
        ZERO_ADDRESS,
        Wei(0),
        Termination(1700000000),
    )

    msg = "Tried to challenge own claim"
    assert not node._event_processor._maybe_challenge(request, claim_event), msg


@pytest.mark.parametrize("allow_unlisted_pairs", (True, False))
def test_fill_and_claim(request_manager, token, node, allow_unlisted_pairs):
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


def test_withdraw(request_manager, token, node):
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


def test_expired_request_is_ignored(request_manager, token, node):
    target_address = accounts[1]
    validity_period = request_manager.MIN_VALIDITY_PERIOD()
    # make the request amount high enough that the node cannot fill it
    amount = token.balanceOf(node.address) + 1
    request_id = make_request(
        request_manager,
        token,
        accounts[0],
        target_address,
        amount,
        validity_period=validity_period,
    )

    brownie.chain.mine(timedelta=validity_period / 2)
    with Sleeper(1) as sleeper:
        while (request := node.request_tracker.get(request_id)) is None:
            sleeper.sleep(0.1)

    assert request.is_pending

    brownie.chain.mine(timedelta=validity_period / 2 + 1)
    with Sleeper(1) as sleeper:
        while not request.is_unfillable:
            sleeper.sleep(0.1)
