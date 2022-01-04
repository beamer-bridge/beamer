import brownie
from brownie import accounts, chain, web3


def test_only_sender_can_cancel_request(request_manager, token):
    requester = accounts[1]
    other = accounts[2]

    transfer_amount = 23

    token.mint(requester, transfer_amount, {"from": requester})
    token.approve(request_manager.address, transfer_amount, {"from": requester})
    request_tx = request_manager.request(
        1,
        token.address,
        token.address,
        "0x5d5640575161450A674a094730365A223B226649",
        transfer_amount,
        {"from": requester},
    )
    request_id = request_tx.return_value

    with brownie.reverts("Sender is not requester"):
        request_manager.cancelRequest(request_id, {"from": other})

    request_manager.cancelRequest(request_id, {"from": requester})


def test_cancelled_request_withdraw(request_manager, token, cancellation_period):
    requester = accounts[1]
    other = accounts[2]

    transfer_amount = 23

    token.mint(requester, transfer_amount, {"from": requester})
    assert token.balanceOf(requester) == transfer_amount

    token.approve(request_manager.address, transfer_amount, {"from": requester})
    request_tx = request_manager.request(
        1,
        token.address,
        token.address,
        "0x5d5640575161450A674a094730365A223B226649",
        transfer_amount,
        {"from": requester},
    )
    request_id = request_tx.return_value

    assert token.balanceOf(requester) == 0
    assert token.balanceOf(other) == 0

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

    token.mint(requester, transfer_amount, {"from": requester})
    assert token.balanceOf(requester) == transfer_amount

    token.approve(request_manager.address, transfer_amount, {"from": requester})
    request_tx = request_manager.request(
        1,
        token.address,
        token.address,
        "0x5d5640575161450A674a094730365A223B226649",
        transfer_amount,
        {"from": requester},
    )
    request_id = request_tx.return_value

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

    token.mint(requester, transfer_amount, {"from": requester})
    assert token.balanceOf(requester) == transfer_amount
    assert token.balanceOf(claimer) == 0
    assert token.balanceOf(challenger) == 0
    assert token.balanceOf(request_manager.address) == 0

    token.approve(request_manager.address, transfer_amount, {"from": requester})
    request_tx = request_manager.request(
        1,
        token.address,
        token.address,
        "0x5d5640575161450A674a094730365A223B226649",
        transfer_amount,
        {"from": requester},
    )
    request_id = request_tx.return_value

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
