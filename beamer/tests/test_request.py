import time
from unittest.mock import patch

import brownie
import pytest
from brownie import ZERO_ADDRESS, accounts
from eth_utils import to_checksum_address
from web3.types import Wei

from beamer.agent import Agent
from beamer.chain import maybe_challenge
from beamer.events import ClaimMade, RequestFilled
from beamer.request import Request
from beamer.tests.util import HTTPProxy, Sleeper, Timeout, make_request
from beamer.typing import ChainId, ClaimId, FillId, RequestId, Termination, TokenAmount


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

    agent = Agent(config)
    agent.start()
    time.sleep(60)
    agent.stop()
    proxy_l2a.stop()
    proxy_l2b.stop()


def test_challenge_own_claim(config, request_manager, token):
    agent = Agent(config)
    agent_address = to_checksum_address(agent.address)
    claim_stake = request_manager.claimStake()
    request = Request(
        RequestId(100),
        brownie.chain.id,
        brownie.chain.id,
        token.address,
        token.address,
        agent_address,
        TokenAmount(1),
        Termination(1700000000),
    )

    claim_event = ClaimMade(
        brownie.chain.id,
        ClaimId(1),
        request.id,
        FillId(0),
        agent_address,
        claim_stake,
        ZERO_ADDRESS,
        Wei(0),
        Termination(1700000000),
    )

    assert not maybe_challenge(
        request, claim_event, int(time.time()), request_manager, to_checksum_address(agent.address)
    ), "Tried to challenge own claim"


@pytest.mark.parametrize("allow_unlisted_pairs", (True, False))
def test_fill_and_claim(request_manager, token, agent, allow_unlisted_pairs):
    target_address = accounts[1]
    request_id = make_request(request_manager, token, accounts[0], target_address, 1)

    try:
        with Sleeper(5) as sleeper:
            while (request := agent.request_tracker.get(request_id)) is None:
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
    claim_event = claims[0]
    assert claim_event.claimer == agent.address


def test_withdraw(request_manager, token, agent):
    target_address = accounts[1]
    request_id = make_request(request_manager, token, accounts[0], target_address, 1)

    with Sleeper(10) as sleeper:
        while (request := agent.request_tracker.get(request_id)) is None:
            sleeper.sleep(0.1)

        while not request.is_claimed:
            sleeper.sleep(0.1)

    claim_period = request_manager.claimPeriod()
    brownie.chain.mine(timedelta=claim_period)

    with Sleeper(5) as sleeper:
        while not request.is_withdrawn:
            sleeper.sleep(0.1)


def test_expired_request_is_ignored(request_manager, token, agent):
    target_address = accounts[1]
    validity_period = request_manager.MIN_VALIDITY_PERIOD()
    # make the request amount high enough that the agent cannot fill it
    amount = token.balanceOf(agent.address) + 1
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
        while (request := agent.request_tracker.get(request_id)) is None:
            sleeper.sleep(0.1)

    assert request.is_pending

    brownie.chain.mine(timedelta=validity_period / 2 + 1)
    with Sleeper(1) as sleeper:
        while not request.is_unfillable:
            sleeper.sleep(0.1)


# Disable filling of requests in the agent
# TODO: Find a better way to do this
@patch("beamer.chain.fill_request")
def test_agent_ignores_invalid_fill(_, request_manager, token, agent: Agent):
    target, filler = accounts[1:3]
    validity_period = request_manager.MIN_VALIDITY_PERIOD()
    chain_id = ChainId(brownie.chain.id)
    amount = token.balanceOf(agent.address)

    request_id = make_request(
        request_manager,
        token,
        accounts[0],
        target,
        amount,
        validity_period=validity_period,
    )

    with Sleeper(1) as sleeper:
        while (request := agent.request_tracker.get(request_id)) is None:
            sleeper.sleep(0.1)

    event_processor = agent._event_processor

    # Test wrong amount
    event_processor.add_events(
        [
            RequestFilled(
                chain_id=chain_id,
                request_id=RequestId(request_id),
                fill_id=FillId(1),
                source_chain_id=chain_id,
                target_token_address=token,
                filler=filler,
                amount=amount - 1,
            ),
        ]
    )
    time.sleep(1)
    assert not request.is_filled

    # Test wrong `source_chain_id`
    event_processor.add_events(
        [
            RequestFilled(
                chain_id=chain_id,
                request_id=RequestId(request_id),
                fill_id=FillId(1),
                source_chain_id=ChainId(chain_id + 1),
                target_token_address=token,
                filler=filler,
                amount=amount,
            ),
        ]
    )
    time.sleep(1)
    assert not request.is_filled

    # Test wrong `target_token_address`
    event_processor.add_events(
        [
            RequestFilled(
                chain_id=chain_id,
                request_id=RequestId(request_id),
                fill_id=FillId(1),
                source_chain_id=chain_id,
                target_token_address=filler,
                filler=filler,
                amount=amount,
            ),
        ]
    )
    time.sleep(1)
    assert not request.is_filled

    # Test correct event
    event_processor.add_events(
        [
            RequestFilled(
                chain_id=chain_id,
                request_id=RequestId(request_id),
                fill_id=FillId(1),
                source_chain_id=chain_id,
                target_token_address=token,
                filler=filler,
                amount=amount,
            ),
        ]
    )
    with Sleeper(1) as sleeper:
        while not request.is_filled:
            sleeper.sleep(0.1)
