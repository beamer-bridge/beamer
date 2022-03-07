import os

import brownie
import pytest
from brownie import accounts

import beamer.agent
from beamer.tests.util import EventCollector, earnings, make_request


@pytest.fixture(scope="module", autouse=True)
def _allow_unlisted_pairs():
    old = os.environ.get("RAISYNC_ALLOW_UNLISTED_PAIRS")
    os.environ["RAISYNC_ALLOW_UNLISTED_PAIRS"] = "1"
    yield
    if old is None:
        del os.environ["RAISYNC_ALLOW_UNLISTED_PAIRS"]
    else:
        os.environ["RAISYNC_ALLOW_UNLISTED_PAIRS"] = old


# Scenario 1:
#
# Bob              Charlie
# --------------------------
# claim
#                  challenge
#
# Winner: Charlie
def test_challenge_1(request_manager, token, config):
    target_address = accounts[8]
    requester, charlie = accounts[:2]

    node = beamer.agent.Node(config)
    node.start()

    w3 = brownie.web3
    with earnings(w3, node, num_fills=1) as node_earnings, earnings(
        w3, charlie, num_fills=0
    ) as charlie_earnings:
        token.approve(request_manager.address, 1, {"from": node.address})
        make_request(request_manager, token, requester, target_address, 1)

        collector = EventCollector(request_manager, "ClaimMade")

        claim = collector.next_event()
        assert claim is not None

        node.stop()
        node.wait()

        request_manager.challengeClaim(
            claim.claimId, {"from": charlie, "value": claim.claimerStake + 1}
        )

        claim = collector.next_event()
        assert claim is not None
        brownie.chain.mine(timestamp=claim.termination)
        request_manager.withdraw(claim.claimId, {"from": charlie})

    assert charlie_earnings() == claim.claimerStake
    assert node_earnings() == -claim.claimerStake


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
    target_address = accounts[8]
    requester, charlie = accounts[:2]

    node = beamer.agent.Node(config)
    node.start()

    w3 = brownie.web3
    with earnings(w3, node, num_fills=1) as node_earnings, earnings(
        w3, charlie, num_fills=0
    ) as charlie_earnings:
        token.approve(request_manager.address, 1, {"from": node.address})
        make_request(request_manager, token, requester, target_address, 1)

        collector = EventCollector(request_manager, "ClaimMade")

        claim = collector.next_event()
        assert claim is not None

        request_manager.challengeClaim(
            claim.claimId, {"from": charlie, "value": claim.claimerStake + 1}
        )

        # Charlie's claim.
        claim = collector.next_event()
        assert claim is not None
        assert claim.claimerStake < claim.challengerStake

        # Bob's claim.
        claim = collector.next_event()
        assert claim is not None
        assert claim.claimerStake > claim.challengerStake

        brownie.chain.mine(timestamp=claim.termination)
        request_manager.withdraw(claim.claimId, {"from": node.address})

        node.stop()
        node.wait()

    fees = request_manager.gasReimbursementFee() + request_manager.lpServiceFee()
    assert node_earnings() == claim.challengerStake + fees
    assert charlie_earnings() == -claim.challengerStake


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
    target_address = accounts[8]
    requester, charlie = accounts[:2]

    node = beamer.agent.Node(config)

    w3 = brownie.web3
    with earnings(w3, node, num_fills=0) as node_earnings, earnings(
        w3, charlie, num_fills=0
    ) as charlie_earnings:
        # Submit a request that Bob cannot fill.
        amount = token.balanceOf(node.address) + 1
        request_id = make_request(request_manager, token, requester, target_address, amount)

        stake = request_manager.claimStake()
        request_manager.claimRequest(request_id, 0, {"from": charlie, "value": stake})

        collector = EventCollector(request_manager, "ClaimMade")
        claim = collector.next_event()

        node.start()

        # Get Bob's challenge.
        claim = collector.next_event()
        assert claim is not None
        assert claim.challengerStake > claim.claimerStake and claim.challenger == node.address

        # Ensure that Bob did not fill the request.
        assert EventCollector(fill_manager, "RequestFilled").next_event(wait_time=2) is None

        brownie.chain.mine(timestamp=claim.termination)
        request_manager.withdraw(claim.claimId, {"from": node.address})

        node.stop()
        node.wait()

    assert node_earnings() == claim.claimerStake
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
    target_address = accounts[8]
    requester, charlie = accounts[:2]

    node = beamer.agent.Node(config)

    w3 = brownie.web3
    with earnings(w3, node, num_fills=0) as node_earnings, earnings(
        w3, charlie, num_fills=0
    ) as charlie_earnings:
        # Submit a request that Bob cannot fill.
        amount = token.balanceOf(node.address) + 1
        request_id = make_request(request_manager, token, requester, target_address, amount)

        stake = request_manager.claimStake()
        request_manager.claimRequest(request_id, 0, {"from": charlie, "value": stake})

        collector = EventCollector(request_manager, "ClaimMade")
        claim = collector.next_event()

        node.start()

        # Get Bob's challenge.
        claim = collector.next_event()
        assert claim is not None
        assert claim.challengerStake > claim.claimerStake and claim.challenger == node.address

        # Ensure that Bob did not fill the request.
        assert EventCollector(fill_manager, "RequestFilled").next_event(wait_time=2) is None

        node.stop()
        node.wait()

        request_manager.challengeClaim(
            claim.claimId, {"from": charlie, "value": claim.challengerStake + 1}
        )

        claim = collector.next_event()
        assert claim is not None
        assert claim.claimerStake > claim.challengerStake and claim.claimer == charlie.address

        brownie.chain.mine(timestamp=claim.termination)
        request_manager.withdraw(claim.claimId, {"from": charlie})

    fees = request_manager.gasReimbursementFee() + request_manager.lpServiceFee()
    assert node_earnings() == -claim.challengerStake
    assert charlie_earnings() == claim.challengerStake + fees
