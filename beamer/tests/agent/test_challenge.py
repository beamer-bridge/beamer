import os
import time

import ape
import pytest
from eth_utils import to_checksum_address

import beamer.agent.agent
from beamer.tests.constants import FILL_ID
from beamer.tests.util import (
    EventCollector,
    alloc_accounts,
    alloc_whitelisted_accounts,
    earnings,
    make_request,
)


@pytest.fixture(scope="module", autouse=True)
def _allow_unlisted_pairs():
    old = os.environ.get("BEAMER_ALLOW_UNLISTED_PAIRS")
    os.environ["BEAMER_ALLOW_UNLISTED_PAIRS"] = "1"
    yield
    if old is None:
        del os.environ["BEAMER_ALLOW_UNLISTED_PAIRS"]
    else:
        os.environ["BEAMER_ALLOW_UNLISTED_PAIRS"] = old


# Scenario 1:
#
# Bob              Charlie
# --------------------------
# claim
#                  challenge
#
# Winner: Charlie
def test_challenge_1(request_manager, token, config):
    requester, charlie, target = alloc_accounts(3)

    agent = beamer.agent.agent.Agent(config)
    agent.start()

    w3 = ape.chain.provider.web3
    with earnings(w3, agent) as agent_earnings, earnings(w3, charlie) as charlie_earnings:
        token.approve(request_manager, 1, sender=agent.address)
        make_request(request_manager, token, requester, target, 1, fee_data="standard")

        collector = EventCollector(request_manager, "ClaimMade")

        claim = collector.next_event()
        assert claim is not None

        agent.stop()
        agent.wait()

        request_manager.challengeClaim(claim.claimId, sender=charlie, value=claim.claimerStake + 1)

        claim = collector.next_event()
        assert claim is not None
        ape.chain.mine(timestamp=claim.termination)
        request_manager.withdraw(claim.claimId, sender=charlie)

    assert charlie_earnings() == claim.claimerStake
    assert agent_earnings() == -claim.claimerStake


# Scenario 2:
#
# Bob              Charlie
# --------------------------
# claim
#                  challenge
# challenge
#
# Winner: Bob
def test_challenge_2(request_manager, token, config):
    requester, charlie, target = alloc_accounts(3)

    agent = beamer.agent.agent.Agent(config)
    agent.start()

    w3 = ape.chain.provider.web3
    with earnings(w3, agent) as agent_earnings, earnings(w3, charlie) as charlie_earnings:
        token.approve(request_manager, 1, sender=agent.address)
        make_request(request_manager, token, requester, target, 1, fee_data="standard")

        collector = EventCollector(request_manager, "ClaimMade")

        claim = collector.next_event()
        assert claim is not None

        request_manager.challengeClaim(claim.claimId, sender=charlie, value=claim.claimerStake + 1)

        # Charlie's claim.
        claim = collector.next_event()
        assert claim is not None
        assert claim.claimerStake < claim.challengerStakeTotal

        # Bob's claim.
        claim = collector.next_event()
        assert claim is not None
        assert claim.claimerStake > claim.challengerStakeTotal

        ape.chain.mine(timestamp=claim.termination)
        request_manager.withdraw(claim.claimId, sender=agent.address)

        agent.stop()
        agent.wait()

    assert agent_earnings() == claim.challengerStakeTotal
    assert charlie_earnings() == -claim.challengerStakeTotal


# Scenario 3:
#
# Bob              Charlie
# --------------------------
#                  claim
# challenge
#
# Winner: Bob
#
# Note: Bob is not filling the request here, merely noticing the dishonest
# claim and challenging it.
def test_challenge_3(request_manager, fill_manager, token, config):
    requester, target = alloc_accounts(2)
    (charlie,) = alloc_whitelisted_accounts(1, [request_manager])
    agent = beamer.agent.agent.Agent(config)

    w3 = ape.chain.provider.web3
    with earnings(w3, agent) as agent_earnings, earnings(w3, charlie) as charlie_earnings:
        # Submit a request that Bob cannot fill.
        amount = token.balanceOf(agent.address) + 1
        request_id = make_request(
            request_manager, token, requester, target, amount, fee_data="standard"
        )

        stake = request_manager.claimStake()
        request_manager.claimRequest(request_id, FILL_ID, sender=charlie, value=stake)

        collector = EventCollector(request_manager, "ClaimMade")
        collector.next_event()

        agent.start()

        # Get Bob's challenge.
        claim = collector.next_event()
        assert claim is not None
        assert (
            claim.challengerStakeTotal > claim.claimerStake
            and claim.lastChallenger == agent.address
        )

        # Ensure that Bob did not fill the request.
        assert EventCollector(fill_manager, "RequestFilled").next_event(wait_time=2) is None

        ape.chain.mine(timestamp=claim.termination)
        request_manager.withdraw(claim.claimId, sender=agent.address)

        agent.stop()
        agent.wait()

    assert agent_earnings() == claim.claimerStake
    assert charlie_earnings() == -claim.claimerStake


# Scenario 4:
#
# Bob              Charlie
# --------------------------
#                  claim
# challenge
#                  challenge
#
# Winner: Charlie
#
# Note: Bob is not filling the request here, merely noticing the dishonest
# claim and challenging it.
def test_challenge_4(request_manager, fill_manager, token, config):
    requester, target = alloc_accounts(2)
    (charlie,) = alloc_whitelisted_accounts(1, [request_manager])
    agent = beamer.agent.agent.Agent(config)

    w3 = ape.chain.provider.web3
    with earnings(w3, agent) as agent_earnings, earnings(w3, charlie) as charlie_earnings:
        # Submit a request that Bob cannot fill.
        amount = token.balanceOf(agent.address) + 1
        request_id = make_request(
            request_manager, token, requester, target, amount, fee_data="standard"
        )

        stake = request_manager.claimStake()
        request_manager.claimRequest(request_id, FILL_ID, sender=charlie, value=stake)

        collector = EventCollector(request_manager, "ClaimMade")
        claim = collector.next_event()

        agent.start()

        # Get Bob's challenge.
        claim = collector.next_event()
        assert claim is not None
        assert (
            claim.challengerStakeTotal > claim.claimerStake
            and claim.lastChallenger == agent.address
        )

        # Ensure that Bob did not fill the request.
        assert EventCollector(fill_manager, "RequestFilled").next_event(wait_time=2) is None

        agent.stop()
        agent.wait()

        request_manager.challengeClaim(
            claim.claimId, sender=charlie, value=claim.challengerStakeTotal + 1
        )

        claim = collector.next_event()
        assert claim is not None
        assert claim.claimerStake > claim.challengerStakeTotal and claim.claimer == charlie

        ape.chain.mine(timestamp=claim.termination)
        request_manager.withdraw(claim.claimId, sender=charlie)

    assert agent_earnings() == -claim.challengerStakeTotal
    assert charlie_earnings() == claim.challengerStakeTotal


# Scenario 5:
#
# Bob              Charlie
# --------------------------
#                  fill (if honest)
#                  claim
#
# ....fill_wait_time....
#
# challenge (if not honest)
#
#
# Note: This test tests if Bob waits `fill_wait_time` seconds before challenging
# a dishonest claim
@pytest.mark.parametrize("honest_claim", [True, False])
def test_challenge_5(request_manager, fill_manager, token, config, honest_claim):
    requester, target = alloc_accounts(2)
    (charlie,) = alloc_whitelisted_accounts(1, [request_manager, fill_manager])
    config.fill_wait_time = 5

    agent = beamer.agent.agent.Agent(config)
    agent.start()

    # Submit a request that Bob cannot fill.
    amount = token.balanceOf(agent.address) + 1
    request_id = make_request(
        request_manager, token, requester, target, amount, fee_data="standard"
    )
    # FIXME: Nonce is one because it was the only request created
    # ideally we should get it from the event which is dropped by make_request()
    nonce = 1
    fill_id = FILL_ID
    with ape.accounts.test_accounts.use_sender(charlie):
        if honest_claim:
            # Fill by Charlie
            token.mint(charlie, amount)
            token.approve(fill_manager, amount)
            fill_transaction = fill_manager.fillRequest(
                ape.chain.chain_id,
                token,
                target,
                amount,
                nonce,
            )
            fill_id = fill_transaction.return_value

        # claim by Charlie
        stake = request_manager.claimStake()
        request_manager.claimRequest(request_id, fill_id, value=stake)

    collector = EventCollector(request_manager, "ClaimMade")
    claim = collector.next_event()
    assert claim is not None

    # Wait just before the challenge back off time
    time.sleep(config.fill_wait_time - 1)

    # Regardless of the honesty of the claim there should be no challenge event
    claim = collector.next_event(0.1)
    assert claim is None

    claim = collector.next_event(20)
    if honest_claim:
        # No challenge received
        assert claim is None
    else:
        # Challenge expected
        assert claim is not None
        assert claim.lastChallenger == to_checksum_address(agent.address)

    agent.stop()
    agent.wait()


# Scenario 6:
#
# Charlie          Dave
# --------------------------
# claim
#                  challenge
#
# Winner: Charlie
#
# Note: Bob is not participating in the challenge here. We test whether Bob
# will attempt to withdraw the stakes in place of Dave.
def test_withdraw_not_participant(request_manager, token, config):
    requester, dave, target = alloc_accounts(3)
    (charlie,) = alloc_whitelisted_accounts(1, [request_manager])
    agent = beamer.agent.agent.Agent(config)

    # Submit a request that Bob cannot fill.
    amount = token.balanceOf(agent.address) + 1
    request_id = make_request(
        request_manager, token, requester, target, amount, fee_data="standard"
    )

    stake = request_manager.claimStake()
    request_manager.claimRequest(request_id, FILL_ID, sender=charlie, value=stake)

    collector = EventCollector(request_manager, "ClaimMade")
    claim = collector.next_event()
    assert claim is not None

    request_manager.challengeClaim(claim.claimId, sender=dave, value=stake + 1)
    ape.chain.mine(timestamp=claim.termination)

    agent.start()

    # We wait enough time for agent to potentially withdraw
    collector = EventCollector(request_manager, "ClaimStakeWithdrawn")
    withdraw_event = collector.next_event(wait_time=2)
    assert withdraw_event is None

    agent.stop()
    agent.wait()


# Scenario 7:
#
# Bob              Charlie              Dave
# -----------------------------------------------
#                  claim
#                                       challenge
#                  challenge
# challenge
# Winner: Bob + Dave
#
# Note: testing that the agent can handle multiparty bidding
def test_challenge_7(request_manager, fill_manager, token, config):
    requester, dave, target = alloc_accounts(3)
    (charlie,) = alloc_whitelisted_accounts(1, [request_manager])
    agent = beamer.agent.agent.Agent(config)

    w3 = ape.chain.provider.web3
    with earnings(w3, agent) as agent_earnings, earnings(w3, dave) as dave_earnings:
        # Submit a request that Bob cannot fill.
        amount = token.balanceOf(agent.address) + 1
        request_id = make_request(request_manager, token, requester, target, amount)

        stake = request_manager.claimStake()
        request_manager.claimRequest(request_id, FILL_ID, sender=charlie, value=stake)

        collector = EventCollector(request_manager, "ClaimMade")
        claim = collector.next_event()
        assert claim is not None

        # Dave challenges
        request_manager.challengeClaim(claim.claimId, sender=dave, value=claim.claimerStake + 1)

        claim = collector.next_event()
        assert claim is not None

        agent.start()

        # Ensure that Bob did not fill the request.
        assert EventCollector(fill_manager, "RequestFilled").next_event(wait_time=2) is None

        request_manager.challengeClaim(claim.claimId, sender=charlie, value=stake + 1)

        claim = collector.next_event()
        assert claim is not None
        assert claim.claimerStake > claim.challengerStakeTotal and claim.claimer == charlie

        # Get Bob's challenge.
        claim = collector.next_event()
        assert claim is not None
        assert (
            claim.challengerStakeTotal > claim.claimerStake
            and claim.lastChallenger == agent.address
        )

        ape.chain.mine(timestamp=claim.termination)

        request_manager.withdraw(claim.claimId, sender=agent.address)
        request_manager.withdraw(claim.claimId, sender=dave)

        agent.stop()
        agent.wait()

    assert agent_earnings() == stake
    assert dave_earnings() == stake + 1
