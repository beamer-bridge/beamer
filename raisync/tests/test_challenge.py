import os

import brownie
import pytest
from brownie import accounts
from eth_utils import encode_hex

import raisync.node
from raisync.tests.util import EventCollector, balance_diff, make_request


@pytest.fixture(scope="module", autouse=True)
def _allow_unlisted_pairs():
    old = os.environ.get("RAISYNC_ALLOW_UNLISTED_PAIRS")
    os.environ["RAISYNC_ALLOW_UNLISTED_PAIRS"] = "1"
    yield
    if old is None:
        del os.environ["RAISYNC_ALLOW_UNLISTED_PAIRS"]
    else:
        os.environ["RAISYNC_ALLOW_UNLISTED_PAIRS"] = old


def _total_tx_cost(address, num_fills):
    total = 0
    for block_number in range(brownie.chain.height + 1):
        block = brownie.web3.eth.get_block(block_number)
        for tx_hash in block.transactions:
            tx = brownie.web3.eth.get_transaction(tx_hash)
            if tx["from"] == address:
                print(
                    encode_hex(tx.hash),
                    block_number,
                    tx.gasPrice,
                    tx.gas,
                    tx.gasPrice * tx.gas,
                    tx.value,
                )
                total += tx.gasPrice * tx.gas

    # We are subtracting 300k gwei here because the token.transferFrom inside
    # FillManager.fillRequest seems to cost that much, however, ganache does
    # not reflect that in the account's balance.
    total -= num_fills * int(300e12)
    return total


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

    node = raisync.node.Node(config)
    node.start()

    w3 = brownie.web3
    with balance_diff(w3, node) as node_diff, balance_diff(w3, charlie) as charlie_diff:
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

    assert node_diff() == -_total_tx_cost(node.address, 1) - claim.claimerStake
    assert charlie_diff() == claim.claimerStake - _total_tx_cost(charlie.address, 0)


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

    node = raisync.node.Node(config)
    node.start()

    w3 = brownie.web3
    with balance_diff(w3, node) as node_diff, balance_diff(w3, charlie) as charlie_diff:
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
    assert node_diff() == claim.challengerStake + fees - _total_tx_cost(node.address, 1)
    assert charlie_diff() == -claim.challengerStake - _total_tx_cost(charlie.address, 0)


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

    node = raisync.node.Node(config)

    w3 = brownie.web3
    with balance_diff(w3, node) as node_diff, balance_diff(w3, charlie) as charlie_diff:
        # Submit a request that Bob cannot fill.
        amount = token.balanceOf(node.address) + 1
        request_id = make_request(request_manager, token, requester, target_address, amount)

        stake = request_manager.claimStake()
        request_manager.claimRequest(request_id, {"from": charlie, "value": stake})

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

    assert node_diff() == claim.claimerStake - _total_tx_cost(node.address, 0)
    assert charlie_diff() == -claim.claimerStake - _total_tx_cost(charlie.address, 0)


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

    node = raisync.node.Node(config)

    w3 = brownie.web3
    with balance_diff(w3, node) as node_diff, balance_diff(w3, charlie) as charlie_diff:
        # Submit a request that Bob cannot fill.
        amount = token.balanceOf(node.address) + 1
        request_id = make_request(request_manager, token, requester, target_address, amount)

        stake = request_manager.claimStake()
        request_manager.claimRequest(request_id, {"from": charlie, "value": stake})

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
    assert node_diff() == -claim.challengerStake - _total_tx_cost(node.address, 0)
    assert charlie_diff() == claim.challengerStake + fees - _total_tx_cost(charlie.address, 0)
