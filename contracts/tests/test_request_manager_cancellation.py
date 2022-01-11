import brownie
from brownie import accounts, chain, web3

from contracts.tests.utils import make_request


def test_only_sender_can_cancel_request(request_manager, token):
    requester = accounts[1]
    other = accounts[2]

    transfer_amount = 23
    request_id = make_request(request_manager, token, requester, transfer_amount)

    with brownie.reverts("Sender is not requester"):
        request_manager.cancelRequest(request_id, {"from": other})

    request_manager.cancelRequest(request_id, {"from": requester})


def test_request_can_be_cancelled_only_once(request_manager, token):
    requester = accounts[1]
    transfer_amount = 23
    request_id = make_request(request_manager, token, requester, transfer_amount)

    request_manager.cancelRequest(request_id, {"from": requester})

    with brownie.reverts("Request already cancelled"):
        request_manager.cancelRequest(request_id, {"from": requester})


def test_cancelled_request_withdraw(request_manager, token, cancellation_period):
    requester = accounts[1]
    other = accounts[2]

    transfer_amount = 23
    request_id = make_request(request_manager, token, requester, transfer_amount)

    assert token.balanceOf(requester) == 0
    assert token.balanceOf(other) == 0

    with brownie.reverts("Request not cancelled"):
        request_manager.withdrawCancelledRequest(request_id, {"from": requester})

    cancel_tx = request_manager.cancelRequest(request_id, {"from": requester})

    assert "RequestCancelled" in cancel_tx.events
    assert token.balanceOf(requester) == 0

    with brownie.reverts("Cancellation period not over yet"):
        request_manager.withdrawCancelledRequest(request_id, {"from": requester})

    # Timetravel after cancellation period
    chain.mine(timedelta=cancellation_period)

    # The tx sender is not important here, the funds are sent to the request sender
    request_manager.withdrawCancelledRequest(request_id, {"from": other})

    assert token.balanceOf(requester) == transfer_amount
    assert token.balanceOf(other) == 0

    # Another request fails
    with brownie.reverts("Deposit already withdrawn"):
        request_manager.withdrawCancelledRequest(request_id, {"from": requester})


def test_cancelled_request_claim_successful(
    request_manager, token, cancellation_period, claim_stake, claim_period
):
    """Test that withdrawing a cancelled request after a successful claim is impossible"""

    requester = accounts[1]
    claimer = accounts[2]

    transfer_amount = 23
    request_id = make_request(request_manager, token, requester, transfer_amount)

    request_manager.cancelRequest(request_id, {"from": requester})

    claim_tx = request_manager.claimRequest(request_id, {"from": claimer, "value": claim_stake})
    claim_id = claim_tx.return_value

    # Timetravel after claim period
    chain.mine(timedelta=claim_period)

    withdraw_tx = request_manager.withdraw(claim_id, {"from": claimer})
    assert "ClaimWithdrawn" in withdraw_tx.events

    # Timetravel after cancellation period
    chain.mine(timedelta=cancellation_period)

    with brownie.reverts("Deposit already withdrawn"):
        request_manager.withdrawCancelledRequest(request_id, {"from": requester})


def test_cancelled_request_claim_failed(
    request_manager, token, claim_stake, claim_period, challenge_period
):
    """Test that withdrawing a cancelled request after an unsuccessful claim is possible"""

    requester = accounts[1]
    claimer = accounts[2]
    challenger = accounts[3]

    transfer_amount = 23

    claimer1_eth_balance = web3.eth.get_balance(claimer.address)
    challenger_eth_balance = web3.eth.get_balance(challenger.address)

    request_id = make_request(request_manager, token, requester, transfer_amount)

    assert token.balanceOf(requester) == 0
    assert token.balanceOf(claimer) == 0
    assert token.balanceOf(challenger) == 0
    assert token.balanceOf(request_manager.address) == transfer_amount

    request_manager.cancelRequest(request_id, {"from": requester})

    claim_tx = request_manager.claimRequest(request_id, {"from": claimer, "value": claim_stake})
    claim_id = claim_tx.return_value

    request_manager.challengeClaim(claim_id, {"from": challenger, "value": claim_stake + 1})

    assert web3.eth.get_balance(request_manager.address) == 2 * claim_stake + 1
    assert web3.eth.get_balance(claimer.address) == claimer1_eth_balance - claim_stake
    assert web3.eth.get_balance(challenger.address) == challenger_eth_balance - claim_stake - 1

    # Timetravel after claim period
    chain.mine(timedelta=claim_period + challenge_period)

    withdraw_tx = request_manager.withdraw(claim_id, {"from": claimer})
    assert "ClaimWithdrawn" not in withdraw_tx.events

    assert web3.eth.get_balance(request_manager.address) == 0
    assert web3.eth.get_balance(claimer.address) == claimer1_eth_balance - claim_stake
    assert web3.eth.get_balance(challenger.address) == challenger_eth_balance + claim_stake

    assert token.balanceOf(requester) == 0
    assert token.balanceOf(claimer) == 0
    assert token.balanceOf(challenger) == 0
    assert token.balanceOf(request_manager.address) == transfer_amount

    # The requester can now withdraw the funds
    request_manager.withdrawCancelledRequest(request_id, {"from": requester})

    assert token.balanceOf(requester) == transfer_amount
    assert token.balanceOf(claimer) == 0
    assert token.balanceOf(challenger) == 0
    assert token.balanceOf(request_manager.address) == 0


def test_claim_after_cancelled_request_fails(
    request_manager, token, cancellation_period, claim_stake
):
    """Test that claiming after withdrawing a cancelled request fails"""

    requester = accounts[1]
    claimer = accounts[2]

    transfer_amount = 23
    request_id = make_request(request_manager, token, requester, transfer_amount)

    request_manager.cancelRequest(request_id, {"from": requester})

    # Timetravel after cancellation period
    chain.mine(timedelta=cancellation_period)
    request_manager.withdrawCancelledRequest(request_id, {"from": requester})

    with brownie.reverts("Deposit already withdrawn"):
        request_manager.claimRequest(request_id, {"from": claimer, "value": claim_stake})
