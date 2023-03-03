import time
from unittest.mock import patch

import ape
import pytest
from eth_utils import to_checksum_address
from hexbytes import HexBytes
from web3.constants import ADDRESS_ZERO
from web3.types import Timestamp, Wei

from beamer.agent.agent import Agent
from beamer.agent.chain import maybe_challenge
from beamer.agent.events import ClaimMade, RequestFilled
from beamer.agent.models.claim import Claim
from beamer.agent.models.request import Request
from beamer.agent.typing import (
    BlockNumber,
    ChainId,
    ClaimId,
    FillId,
    Nonce,
    RequestId,
    Termination,
    TokenAmount,
)
from beamer.tests.agent.unit.utils import BLOCK_NUMBER
from beamer.tests.util import Sleeper, Timeout, alloc_accounts, make_request


def test_challenge_own_claim(config, request_manager, token, direction):
    agent = Agent(config)
    agent_address = to_checksum_address(agent.address)
    claim_stake = request_manager.claimStake()
    request = Request(
        RequestId(b"1"),
        ChainId(ape.chain.chain_id),
        ChainId(ape.chain.chain_id),
        token.address,
        token.address,
        agent_address,
        TokenAmount(1),
        Nonce(100),
        Termination(1700000000),
    )

    claim = Claim(
        ClaimMade(
            chain_id=ChainId(ape.chain.chain_id),
            tx_hash=HexBytes(b""),
            claim_id=ClaimId(1),
            request_id=request.id,
            fill_id=FillId(b"1"),
            claimer=agent_address,
            claimer_stake=claim_stake,
            last_challenger=to_checksum_address(ADDRESS_ZERO),
            challenger_stake_total=Wei(0),
            termination=Termination(1700000000),
            block_number=BLOCK_NUMBER,
        ),
        int(time.time()),
    )
    # Add context so that maybe_challenge verifies that the claim is not expired
    context = agent.get_context(direction)
    context.requests.add(request.id, request)
    context.latest_blocks[ChainId(ape.chain.chain_id)] = {"timestamp": Timestamp(0)}

    assert not maybe_challenge(claim, context), "Tried to challenge own claim"


def test_fill_and_claim(request_manager, token, agent, direction):
    requester, target = alloc_accounts(2)
    request_id = make_request(request_manager, token, requester, target, 1)

    with Sleeper(5) as sleeper:
        while (request := agent.get_context(direction).requests.get(request_id)) is None:
            sleeper.sleep(0.1)

    assert request.id == request_id

    with Sleeper(5) as sleeper:
        while not request.is_claimed:
            sleeper.sleep(0.1)

    found_claims: list[Claim] = []
    with Sleeper(5) as sleeper:
        while not found_claims:
            for claim in agent.get_context(direction).claims:
                if claim.request_id == request_id:
                    found_claims.append(claim)
            sleeper.sleep(0.1)

    assert len(found_claims) == 1
    claim = found_claims[0]
    assert claim.claimer == agent.address


@pytest.mark.parametrize("allowance", [None, "-1", "1", "3"])
def test_allowance(request_manager, fill_manager, token, agent, direction, allowance):
    """
    Allowance can have 4 different values

    If None (backwards compatibility), the requested amount will be approved.
    If -1, approved value will be type(uint256).max
    If allowance < requested amount, agent will not fill
    If allowance >= requested amount, configured value will be used
    """
    requester, target = alloc_accounts(2)
    amount = 2
    request_id = make_request(request_manager, token, requester, target, amount)

    match allowance:
        case None:
            actual_allowance = amount
        case "-1":
            actual_allowance = 2**256 - 1
        case _:
            actual_allowance = int(allowance)

    try:
        with Sleeper(5) as sleeper:
            while (
                request := agent.get_context(direction).requests.get(request_id)
            ) is None or request.filler != agent.address:
                sleeper.sleep(0.1)
    except Timeout:
        # Agent did not fill
        assert actual_allowance < amount
    else:
        allowance_after = token.allowance(agent.address, fill_manager)

        # Some token contracts implement an unlimited allowance as type(uint256).max,
        # others start decreasing the allowance from the highest amount.
        # We use an ERC20 implementation which does the former.
        if actual_allowance == 2**256 - 1:
            assert allowance_after == actual_allowance
        else:
            assert allowance_after == actual_allowance - amount


def test_withdraw(request_manager, token, agent, direction):
    requester, target = alloc_accounts(2)
    request_id = make_request(request_manager, token, requester, target, 1)

    with Sleeper(10) as sleeper:
        while (request := agent.get_context(direction).requests.get(request_id)) is None:
            sleeper.sleep(0.1)

        while not request.is_claimed:
            sleeper.sleep(0.1)

    claim_period = request_manager.claimPeriod()
    ape.chain.mine(deltatime=claim_period)

    with Sleeper(5) as sleeper:
        while not request.is_withdrawn:
            sleeper.sleep(0.1)


def test_expired_request_is_ignored(request_manager, token, agent, direction):
    requester, target = alloc_accounts(2)
    validity_period = request_manager.MIN_VALIDITY_PERIOD()
    # make the request amount high enough that the agent cannot fill it
    amount = token.balanceOf(agent.address) + 1
    request_id = make_request(
        request_manager,
        token,
        requester,
        target,
        amount,
        validity_period=validity_period,
    )

    ape.chain.mine(deltatime=validity_period // 2)
    with Sleeper(1) as sleeper:
        while (request := agent.get_context(direction).requests.get(request_id)) is None:
            sleeper.sleep(0.1)

    assert request.is_pending

    ape.chain.mine(deltatime=validity_period // 2 + 1)
    with Sleeper(2) as sleeper:
        while not request.is_ignored:
            sleeper.sleep(0.1)


# Disable filling of requests in the agent
# TODO: Find a better way to do this
@patch("beamer.agent.chain.fill_request")
def test_agent_ignores_invalid_fill(_, request_manager, token, agent: Agent, direction):
    requester, target, filler = alloc_accounts(3)
    validity_period = request_manager.MIN_VALIDITY_PERIOD()
    chain_id = ChainId(ape.chain.chain_id)
    amount = token.balanceOf(agent.address)

    request_id = make_request(
        request_manager,
        token,
        requester,
        target,
        amount,
        validity_period=validity_period,
    )

    with Sleeper(1) as sleeper:
        while (request := agent.get_context(direction).requests.get(request_id)) is None:
            sleeper.sleep(0.1)

    event_processor = agent.get_event_processor(direction)

    assert ape.chain.blocks[-1].number is not None
    # Test wrong amount
    event_processor.add_events(
        [
            RequestFilled(
                chain_id=chain_id,
                tx_hash=HexBytes(b""),
                request_id=request_id,
                fill_id=FillId(b"1"),
                source_chain_id=chain_id,
                target_token_address=token,
                filler=filler,
                amount=amount - 1,
                block_number=BlockNumber(ape.chain.blocks[-1].number),
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
                tx_hash=HexBytes(b""),
                request_id=request_id,
                fill_id=FillId(b"1"),
                source_chain_id=ChainId(chain_id + 1),
                target_token_address=token,
                filler=filler,
                amount=amount,
                block_number=BlockNumber(ape.chain.blocks[-1].number),
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
                tx_hash=HexBytes(b""),
                request_id=request_id,
                fill_id=FillId(b"1"),
                source_chain_id=chain_id,
                target_token_address=filler,
                filler=filler,
                amount=amount,
                block_number=BlockNumber(ape.chain.blocks[-1].number),
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
                tx_hash=HexBytes(b""),
                request_id=request_id,
                fill_id=FillId(b"1"),
                source_chain_id=chain_id,
                target_token_address=token,
                filler=filler,
                amount=amount,
                block_number=BlockNumber(ape.chain.blocks[-1].number),
            ),
        ]
    )
    with Sleeper(1) as sleeper:
        while not request.is_filled:
            sleeper.sleep(0.1)


def test_unsafe_fill_time(
    request_manager, config, token, direction
):  # pylint:disable=unused-argument
    requester, target = alloc_accounts(2)
    max_validity_period = request_manager.MAX_VALIDITY_PERIOD()
    request_id = make_request(request_manager, token, requester, target, 1, max_validity_period)
    # 1 second to fill the request
    config.unsafe_fill_time = max_validity_period - 1
    agent = Agent(config)

    agent.start()

    with Sleeper(2) as sleeper:
        while (request := agent.get_context(direction).requests.get(request_id)) is None:
            sleeper.sleep(0.1)

    assert request.is_ignored

    agent.stop()


def test_request_for_wrong_target_chain(request_manager, token, agent, direction):
    (requester,) = alloc_accounts(1)

    request_manager.setFinalityPeriod(999, 1_000_000)
    test_request_id = make_request(
        request_manager,
        token,
        requester,
        requester,
        1,
        target_chain_id=999,
    )

    valid_request_id = make_request(
        request_manager,
        token,
        requester,
        requester,
        1,
    )

    with Sleeper(1) as sleeper:
        while agent.get_context(direction).requests.get(valid_request_id) is None:
            sleeper.sleep(0.1)

    assert agent.get_context(direction).requests.get(test_request_id) is None


def test_agent_only_claim_once_after_restart(request_manager, token, agent, direction):

    (requester,) = alloc_accounts(1)

    make_request(request_manager, token, requester, requester.address, 1)

    with Sleeper(5) as sleeper:
        while len(agent.get_context(direction).claims) != 1:
            sleeper.sleep(0.1)

    # Restart the agent twice
    for _ in range(2):

        agent.stop()
        agent.start()

        # Wait to sync the claim
        with Sleeper(5) as sleeper:
            while len(agent.get_context(direction).claims) != 1:
                sleeper.sleep(0.1)

        # Make sure there is no second claim happening
        with Sleeper(5) as sleeper:
            while True:
                try:
                    assert len(agent.get_context(direction).claims) == 1
                    sleeper.sleep(0.1)
                except Timeout:
                    break
