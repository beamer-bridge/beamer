import os
import time

import brownie
import pytest
from eth_utils import to_checksum_address

import beamer.agent
from beamer.tests.constants import FILL_ID
from beamer.tests.util import EventCollector, HTTPProxy, alloc_accounts, earnings, make_request


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

    agent = beamer.agent.Agent(config)
    agent.start()

    w3 = brownie.web3
    with earnings(w3, agent) as agent_earnings, earnings(w3, charlie) as charlie_earnings:
        token.approve(request_manager.address, 1, {"from": agent.address})
        make_request(request_manager, token, requester, target, 1, fee_data="standard")

        collector = EventCollector(request_manager, "ClaimMade")

        claim = collector.next_event()
        assert claim is not None

        agent.stop()
        agent.wait()

        request_manager.challengeClaim(
            claim.claimId, {"from": charlie, "value": claim.claimerStake + 1}
        )

        claim = collector.next_event()
        assert claim is not None
        brownie.chain.mine(timestamp=claim.termination)
        request_manager.withdraw(claim.claimId, {"from": charlie})

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

    agent = beamer.agent.Agent(config)
    agent.start()

    w3 = brownie.web3
    with earnings(w3, agent) as agent_earnings, earnings(w3, charlie) as charlie_earnings:
        token.approve(request_manager.address, 1, {"from": agent.address})
        make_request(request_manager, token, requester, target, 1, fee_data="standard")

        collector = EventCollector(request_manager, "ClaimMade")

        claim = collector.next_event()
        assert claim is not None

        request_manager.challengeClaim(
            claim.claimId, {"from": charlie, "value": claim.claimerStake + 1}
        )

        # Charlie's claim.
        claim = collector.next_event()
        assert claim is not None
        assert claim.claimerStake < claim.challengerStakeTotal

        # Bob's claim.
        claim = collector.next_event()
        assert claim is not None
        assert claim.claimerStake > claim.challengerStakeTotal

        brownie.chain.mine(timestamp=claim.termination)
        request_manager.withdraw(claim.claimId, {"from": agent.address})

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
    requester, charlie, target = alloc_accounts(3)
    agent = beamer.agent.Agent(config)

    w3 = brownie.web3
    with earnings(w3, agent) as agent_earnings, earnings(w3, charlie) as charlie_earnings:
        # Submit a request that Bob cannot fill.
        amount = token.balanceOf(agent.address) + 1
        request_id = make_request(
            request_manager, token, requester, target, amount, fee_data="standard"
        )

        stake = request_manager.claimStake()
        request_manager.claimRequest(request_id, FILL_ID, {"from": charlie, "value": stake})

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

        brownie.chain.mine(timestamp=claim.termination)
        request_manager.withdraw(claim.claimId, {"from": agent.address})

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
    requester, charlie, target = alloc_accounts(3)

    agent = beamer.agent.Agent(config)

    w3 = brownie.web3
    with earnings(w3, agent) as agent_earnings, earnings(w3, charlie) as charlie_earnings:
        # Submit a request that Bob cannot fill.
        amount = token.balanceOf(agent.address) + 1
        request_id = make_request(
            request_manager, token, requester, target, amount, fee_data="standard"
        )

        stake = request_manager.claimStake()
        request_manager.claimRequest(request_id, FILL_ID, {"from": charlie, "value": stake})

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
            claim.claimId, {"from": charlie, "value": claim.challengerStakeTotal + 1}
        )

        claim = collector.next_event()
        assert claim is not None
        assert claim.claimerStake > claim.challengerStakeTotal and claim.claimer == charlie.address

        brownie.chain.mine(timestamp=claim.termination)
        request_manager.withdraw(claim.claimId, {"from": charlie})

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
    requester, charlie, target = alloc_accounts(3)

    proxy_l2b = HTTPProxy(config.l2b_rpc_url)
    proxy_l2b.delay_rpc({"eth_getLogs": 3})
    proxy_l2b.start()

    l2b_rpc_url = "http://%s:%s" % (
        proxy_l2b.server_address[0],
        proxy_l2b.server_address[1],
    )

    config.l2b_rpc_url = l2b_rpc_url
    config.fill_wait_time = 6

    agent = beamer.agent.Agent(config)
    agent.start()

    fill_manager.addAllowedLP(charlie.address)

    # Submit a request that Bob cannot fill.
    amount = token.balanceOf(agent.address) + 1
    request_id = make_request(
        request_manager, token, requester, target, amount, fee_data="standard"
    )
    fill_id = FILL_ID

    if honest_claim:
        # Fill by Charlie
        token.mint(charlie.address, amount, {"from": charlie.address})
        token.approve(fill_manager, amount, {"from": charlie.address})
        fill_transaction = fill_manager.fillRequest(
            request_id,
            brownie.chain.id,
            token.address,
            target,
            amount,
            {"from": charlie.address},
        )
        fill_id = fill_transaction.return_value

    # claim by Charlie
    stake = request_manager.claimStake()
    request_manager.claimRequest(request_id, fill_id, {"from": charlie.address, "value": stake})

    collector = EventCollector(request_manager, "ClaimMade")
    claim = collector.next_event()
    assert claim is not None

    # Wait just before the challenge back off time
    time.sleep(config.fill_wait_time - 1)

    # Regardless of the honesty of the claim there should be no challenge event
    claim = collector.next_event(0.1)
    assert claim is None

    claim = collector.next_event()
    if honest_claim:
        # No challenge received
        assert claim is None
    else:
        # Challenge expected
        assert claim is not None
        assert claim.lastChallenger == to_checksum_address(agent.address)

    agent.stop()
    proxy_l2b.stop()
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
    requester, charlie, dave, target = alloc_accounts(4)

    agent = beamer.agent.Agent(config)

    # Submit a request that Bob cannot fill.
    amount = token.balanceOf(agent.address) + 1
    request_id = make_request(
        request_manager, token, requester, target, amount, fee_data="standard"
    )

    stake = request_manager.claimStake()
    request_manager.claimRequest(request_id, FILL_ID, {"from": charlie, "value": stake})

    collector = EventCollector(request_manager, "ClaimMade")
    claim = collector.next_event()
    assert claim is not None

    request_manager.challengeClaim(claim.claimId, {"from": dave, "value": stake + 1})
    brownie.chain.mine(timestamp=claim.termination)

    agent.start()

    # We wait enough time for agent to potentially withdraw
    collector = EventCollector(request_manager, "ClaimWithdrawn")
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
    requester, charlie, dave, target = alloc_accounts(4)
    agent = beamer.agent.Agent(config)

    w3 = brownie.web3
    with earnings(w3, agent) as agent_earnings, earnings(w3, dave) as dave_earnings:
        # Submit a request that Bob cannot fill.
        amount = token.balanceOf(agent.address) + 1
        request_id = make_request(request_manager, token, requester, target, amount)

        stake = request_manager.claimStake()
        request_manager.claimRequest(request_id, FILL_ID, {"from": charlie, "value": stake})

        collector = EventCollector(request_manager, "ClaimMade")
        claim = collector.next_event()
        assert claim is not None

        # Dave challenges
        request_manager.challengeClaim(
            claim.claimId, {"from": dave, "value": claim.claimerStake + 1}
        )

        claim = collector.next_event()
        assert claim is not None

        agent.start()

        # Ensure that Bob did not fill the request.
        assert EventCollector(fill_manager, "RequestFilled").next_event(wait_time=2) is None

        request_manager.challengeClaim(claim.claimId, {"from": charlie, "value": stake + 1})

        claim = collector.next_event()
        assert claim is not None
        assert claim.claimerStake > claim.challengerStakeTotal and claim.claimer == charlie.address

        # Get Bob's challenge.
        claim = collector.next_event()
        assert claim is not None
        assert (
            claim.challengerStakeTotal > claim.claimerStake
            and claim.lastChallenger == agent.address
        )

        brownie.chain.mine(timestamp=claim.termination)

        request_manager.withdraw(claim.claimId, {"from": agent.address})
        request_manager.withdraw(claim.claimId, {"from": dave})

        agent.stop()
        agent.wait()

    assert agent_earnings() == stake
    assert dave_earnings() == stake + 1
