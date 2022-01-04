import brownie
from brownie import accounts, chain, web3


def make_request(request_manager, token, requester, amount) -> int:
    token.mint(requester, amount, {"from": requester})

    token.approve(request_manager.address, amount, {"from": requester})
    request_tx = request_manager.request(
        1,
        token.address,
        token.address,
        "0x5d5640575161450A674a094730365A223B226649",
        amount,
        {"from": requester},
    )
    return request_tx.return_value


def test_claim_with_different_stakes(token, request_manager, claim_stake):
    """Test that only claims with the correct stake can be submitted"""
    request_id = make_request(request_manager, token, accounts[0], 1)

    claim = request_manager.claimRequest(request_id, {"from": accounts[0], "value": claim_stake})
    assert "ClaimCreated" in claim.events

    with brownie.reverts("Stake provided not correct"):
        request_manager.claimRequest(request_id, {"from": accounts[0], "value": claim_stake - 1})

    with brownie.reverts("Stake provided not correct"):
        request_manager.claimRequest(request_id, {"from": accounts[0], "value": claim_stake + 1})

    with brownie.reverts("Stake provided not correct"):
        request_manager.claimRequest(request_id, {"from": accounts[0]})


def test_claim_challenge(request_manager, token, claim_stake):
    """Test challenging a claim"""
    request_id = make_request(request_manager, token, accounts[0], 1)

    claim = request_manager.claimRequest(request_id, {"from": accounts[0], "value": claim_stake})

    with brownie.reverts("Not enough funds provided"):
        request_manager.challengeClaim(
            claim.return_value, {"from": accounts[1], "value": claim_stake}
        )

    with brownie.reverts("Not enough funds provided"):
        request_manager.challengeClaim(claim.return_value, {"from": accounts[1]})

    # Do a proper challenge
    challenge = request_manager.challengeClaim(
        claim.return_value, {"from": accounts[1], "value": claim_stake + 1}
    )
    assert "ClaimChallenged" in challenge.events

    with brownie.reverts("Already challenged"):
        request_manager.challengeClaim(
            claim.return_value, {"from": accounts[1], "value": claim_stake + 1}
        )


def test_claim_counter_challenge(request_manager, token, claim_stake):
    """Test counter-challenging a challenge"""
    claimer = accounts[0]
    challenger = accounts[1]
    request_id = make_request(request_manager, token, accounts[2], 1)

    claim = request_manager.claimRequest(request_id, {"from": claimer, "value": claim_stake})
    claim_id = claim.return_value

    with brownie.reverts("Claim not yet challenged"):
        request_manager.counterChallenge(claim_id, {"from": accounts[2], "value": claim_stake})

    # Do a proper challenge
    request_manager.challengeClaim(claim_id, {"from": challenger, "value": claim_stake + 1})

    # Another party must not be able to join the challenge game
    with brownie.reverts("Already challenged by another address"):
        request_manager.counterChallenge(claim_id, {"from": accounts[2]})

    # The sender of the last challenge must not be able to challenge again
    with brownie.reverts("Not eligible to outbid"):
        request_manager.counterChallenge(claim_id, {"from": challenger})

    # The other party must be able to re-challenge
    outbid = request_manager.counterChallenge(claim_id, {"from": claimer, "value": 2})
    assert "ChallengeCountered" in outbid.events

    # Check that the roles are reversed now
    with brownie.reverts("Not eligible to outbid"):
        request_manager.counterChallenge(claim_id, {"from": claimer, "value": 1})

    # The other party must be able to re-challenge, but must increase the stake
    with brownie.reverts("Not enough funds provided"):
        request_manager.counterChallenge(claim_id, {"from": challenger, "value": 1})
    request_manager.counterChallenge(claim_id, {"from": challenger, "value": 2})


def test_claim_period_extension(
    request_manager, token, claim_stake, claim_period, challenge_period, challenge_period_extension
):
    """Test the extension of the claim/challenge period"""
    claimer = accounts[0]
    challenger = accounts[1]
    request_id = make_request(request_manager, token, accounts[2], 1)

    claim = request_manager.claimRequest(request_id, {"from": claimer, "value": claim_stake})
    claim_id = claim.return_value

    assert claim.timestamp + claim_period == request_manager.claims(claim_id)[3]

    challenge = request_manager.challengeClaim(
        claim_id, {"from": challenger, "value": claim_stake + 1}
    )
    assert challenge.timestamp + challenge_period == request_manager.challenges(claim_id)[3]

    # Another challenge with big margin to the end of the termination
    # shouldn't increase the termination
    request_manager.counterChallenge(claim_id, {"from": claimer, "value": 2})
    assert challenge.timestamp + challenge_period == request_manager.challenges(claim_id)[3]

    # Timetravel close to end of challenge period
    chain.mine(timedelta=challenge_period * 8 / 10)
    rechallenge = request_manager.counterChallenge(claim_id, {"from": challenger, "value": 2})
    assert (
        rechallenge.timestamp + challenge_period_extension
        == request_manager.challenges(claim_id)[3]
    )

    # Timetravel over the end of challenge period
    chain.mine(timedelta=challenge_period_extension)
    with brownie.reverts("Challenge period finished"):
        request_manager.counterChallenge(claim_id, {"from": claimer, "value": 2})


def test_withdraw_nonexistent_claim(request_manager):
    """Test withdrawing a non-existent claim"""
    with brownie.reverts("claimId not valid"):
        request_manager.withdraw(1234, {"from": accounts[0]})


def test_claim_nonexistent_request(request_manager):
    """Test claiming a non-existent request"""
    with brownie.reverts("requestId not valid"):
        request_manager.claimRequest(1234, {"from": accounts[0]})


def test_withdraw_without_challenge(request_manager, token, claim_stake, claim_period):
    """Test withdraw when a claim was not challenged"""
    requester = accounts[1]
    claimer = accounts[2]

    transfer_amount = 23

    claimer_eth_balance = web3.eth.get_balance(claimer.address)

    token.mint(requester, transfer_amount, {"from": requester})
    assert token.balanceOf(requester) == transfer_amount
    assert token.balanceOf(claimer) == 0

    assert web3.eth.get_balance(request_manager.address) == 0

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
    claim_tx = request_manager.claimRequest(request_id, {"from": claimer, "value": claim_stake})
    claim_id = claim_tx.return_value

    assert web3.eth.get_balance(request_manager.address) == claim_stake
    assert web3.eth.get_balance(claimer.address) == claimer_eth_balance - claim_stake

    # Withdraw must fail when claim pariod is not over
    with brownie.reverts("Claim period not finished"):
        request_manager.withdraw(claim_id, {"from": claimer})

    # Timetravel after claim period
    chain.mine(timedelta=claim_period)

    # Even if the requester calls withdraw, the funds go to the claimer
    withdraw_tx = request_manager.withdraw(claim_id, {"from": requester})
    assert "ClaimWithdrawn" in withdraw_tx.events

    assert token.balanceOf(requester) == 0
    assert token.balanceOf(claimer) == transfer_amount

    assert web3.eth.get_balance(request_manager.address) == 0
    assert web3.eth.get_balance(claimer.address) == claimer_eth_balance

    # Another withdraw must fail
    with brownie.reverts("Claim already withdrawn"):
        request_manager.withdraw(claim_id, {"from": claimer})


def test_withdraw_with_challenge(request_manager, token, claim_stake, challenge_period):
    """Test withdraw when a claim was challenged, and the challenger won.
    In that case, the request funds must not be paid out to the challenger."""

    requester = accounts[1]
    claimer = accounts[2]
    challenger = accounts[3]

    transfer_amount = 23

    claimer_eth_balance = web3.eth.get_balance(claimer.address)
    challenger_eth_balance = web3.eth.get_balance(challenger.address)

    token.mint(requester, transfer_amount, {"from": requester})
    assert token.balanceOf(requester) == transfer_amount
    assert token.balanceOf(claimer) == 0
    assert token.balanceOf(challenger) == 0

    assert web3.eth.get_balance(request_manager.address) == 0

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
    claim_tx = request_manager.claimRequest(request_id, {"from": claimer, "value": claim_stake})
    claim_id = claim_tx.return_value

    assert token.balanceOf(request_manager.address) == transfer_amount

    assert web3.eth.get_balance(claimer.address) == claimer_eth_balance - claim_stake
    assert web3.eth.get_balance(challenger.address) == challenger_eth_balance

    request_manager.challengeClaim(claim_id, {"from": challenger, "value": claim_stake + 1})

    assert web3.eth.get_balance(claimer.address) == claimer_eth_balance - claim_stake
    assert web3.eth.get_balance(challenger.address) == challenger_eth_balance - claim_stake - 1

    # Withdraw must fail when claim pariod is not over
    with brownie.reverts("Challenge period not finished"):
        request_manager.withdraw(claim_id, {"from": claimer})

    # Timetravel after claim period
    chain.mine(timedelta=challenge_period)

    assert web3.eth.get_balance(request_manager.address) == 2 * claim_stake + 1

    # The challenger sent the last bet
    # Even if the requester calls withdraw, the challenge funds go to the challenger
    # However, the request funds stay in the contract
    withdraw_tx = request_manager.withdraw(claim_id, {"from": requester})
    assert "ClaimWithdrawn" not in withdraw_tx.events

    assert token.balanceOf(requester) == 0
    assert token.balanceOf(claimer) == 0
    assert token.balanceOf(challenger) == 0
    assert token.balanceOf(request_manager.address) == transfer_amount

    assert web3.eth.get_balance(request_manager.address) == 0
    assert web3.eth.get_balance(claimer.address) == claimer_eth_balance - claim_stake
    assert web3.eth.get_balance(challenger.address) == challenger_eth_balance + claim_stake

    # Another withdraw must fail
    with brownie.reverts("Claim already withdrawn"):
        request_manager.withdraw(claim_id, {"from": claimer})


def test_withdraw_with_two_claims(request_manager, token, claim_stake, claim_period):
    """Test withdraw when a request was claimed twice"""
    requester = accounts[1]
    claimer1 = accounts[2]
    claimer2 = accounts[3]

    transfer_amount = 23

    claimer1_eth_balance = web3.eth.get_balance(claimer1.address)
    claimer2_eth_balance = web3.eth.get_balance(claimer2.address)

    token.mint(requester, transfer_amount, {"from": requester})
    assert token.balanceOf(requester) == transfer_amount
    assert token.balanceOf(claimer1) == 0
    assert token.balanceOf(claimer2) == 0

    assert web3.eth.get_balance(request_manager.address) == 0

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

    claim1_tx = request_manager.claimRequest(request_id, {"from": claimer1, "value": claim_stake})
    claim1_id = claim1_tx.return_value

    claim2_tx = request_manager.claimRequest(request_id, {"from": claimer2, "value": claim_stake})
    claim2_id = claim2_tx.return_value

    assert web3.eth.get_balance(claimer1.address) == claimer1_eth_balance - claim_stake
    assert web3.eth.get_balance(claimer2.address) == claimer2_eth_balance - claim_stake

    # Withdraw must fail when claim pariod is not over
    with brownie.reverts("Claim period not finished"):
        request_manager.withdraw(claim1_id, {"from": claimer1})

    # Timetravel after claim period
    chain.mine(timedelta=claim_period)

    assert web3.eth.get_balance(request_manager.address) == 2 * claim_stake

    # The first claim gets withdrawn first
    # Even if the requester calls withdraw, the funds go to the claimer1
    withdraw1_tx = request_manager.withdraw(claim1_id, {"from": requester})
    assert "ClaimWithdrawn" in withdraw1_tx.events

    assert token.balanceOf(requester) == 0
    assert token.balanceOf(claimer1) == transfer_amount
    assert token.balanceOf(claimer2) == 0

    assert web3.eth.get_balance(request_manager.address) == claim_stake
    assert web3.eth.get_balance(claimer1.address) == claimer1_eth_balance
    assert web3.eth.get_balance(claimer2.address) == claimer2_eth_balance - claim_stake

    # Another withdraw must fail
    with brownie.reverts("Claim already withdrawn"):
        request_manager.withdraw(claim1_id, {"from": claimer1})

    # The other claim must be withdrawable
    request_manager.withdraw(claim2_id, {"from": requester})

    assert token.balanceOf(requester) == 0
    assert token.balanceOf(claimer1) == transfer_amount
    assert token.balanceOf(claimer2) == 0

    assert web3.eth.get_balance(request_manager.address) == 0
    assert web3.eth.get_balance(claimer1.address) == claimer1_eth_balance
    assert web3.eth.get_balance(claimer2.address) == claimer2_eth_balance


def test_withdraw_with_two_claims_and_challenge(
    request_manager, token, claim_stake, claim_period, challenge_period
):
    """Test withdraw when a request was claimed twice and challenged"""
    requester = accounts[1]
    claimer1 = accounts[2]
    claimer2 = accounts[3]
    challenger = accounts[4]

    transfer_amount = 23

    claimer1_eth_balance = web3.eth.get_balance(claimer1.address)
    claimer2_eth_balance = web3.eth.get_balance(claimer2.address)
    challenger_eth_balance = web3.eth.get_balance(challenger.address)

    token.mint(requester, transfer_amount, {"from": requester})
    assert token.balanceOf(requester) == transfer_amount
    assert token.balanceOf(claimer1) == 0
    assert token.balanceOf(claimer2) == 0

    assert web3.eth.get_balance(request_manager.address) == 0

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

    claim1_tx = request_manager.claimRequest(request_id, {"from": claimer1, "value": claim_stake})
    claim1_id = claim1_tx.return_value

    claim2_tx = request_manager.claimRequest(request_id, {"from": claimer2, "value": claim_stake})
    claim2_id = claim2_tx.return_value

    assert web3.eth.get_balance(claimer1.address) == claimer1_eth_balance - claim_stake
    assert web3.eth.get_balance(claimer2.address) == claimer2_eth_balance - claim_stake
    assert web3.eth.get_balance(challenger.address) == challenger_eth_balance

    request_manager.challengeClaim(claim2_id, {"from": challenger, "value": claim_stake + 1})

    assert web3.eth.get_balance(claimer1.address) == claimer1_eth_balance - claim_stake
    assert web3.eth.get_balance(claimer2.address) == claimer2_eth_balance - claim_stake
    assert web3.eth.get_balance(challenger.address) == challenger_eth_balance - claim_stake - 1

    # Withdraw must fail when claim pariod is not over
    with brownie.reverts("Claim period not finished"):
        request_manager.withdraw(claim1_id, {"from": claimer1})

    # Timetravel after claim period
    chain.mine(timedelta=claim_period)

    assert web3.eth.get_balance(request_manager.address) == 3 * claim_stake + 1

    # The first claim gets withdrawn first
    # Even if the requester calls withdraw, the funds go to the claimer1
    withdraw1_tx = request_manager.withdraw(claim1_id, {"from": requester})
    assert "ClaimWithdrawn" in withdraw1_tx.events

    assert token.balanceOf(requester) == 0
    assert token.balanceOf(claimer1) == transfer_amount
    assert token.balanceOf(claimer2) == 0

    assert web3.eth.get_balance(request_manager.address) == 2 * claim_stake + 1
    assert web3.eth.get_balance(claimer1.address) == claimer1_eth_balance
    assert web3.eth.get_balance(claimer2.address) == claimer2_eth_balance - claim_stake
    assert web3.eth.get_balance(challenger.address) == challenger_eth_balance - claim_stake - 1

    # Another withdraw must fail
    with brownie.reverts("Claim already withdrawn"):
        request_manager.withdraw(claim1_id, {"from": claimer1})

    # Timetravel after claim period
    chain.mine(timedelta=challenge_period)

    # The other claim must be withdrawable, but mustn't transfer tokens again
    request_manager.withdraw(claim2_id, {"from": requester})

    assert token.balanceOf(requester) == 0
    assert token.balanceOf(claimer1) == transfer_amount
    assert token.balanceOf(claimer2) == 0

    assert web3.eth.get_balance(request_manager.address) == 0
    assert web3.eth.get_balance(claimer1.address) == claimer1_eth_balance
    assert web3.eth.get_balance(claimer2.address) == claimer2_eth_balance - claim_stake
    assert web3.eth.get_balance(challenger.address) == challenger_eth_balance + claim_stake


def test_withdraw_with_two_claims_first_unsuccessful_then_successful(
    request_manager, token, claim_stake, claim_period, challenge_period
):
    """Test withdraw when a request was claimed twice. The first claim fails, while the second
    is successful and should be paid out the request funds."""
    requester = accounts[1]
    claimer1 = accounts[2]
    claimer2 = accounts[3]
    challenger = accounts[4]

    transfer_amount = 23

    claimer1_eth_balance = web3.eth.get_balance(claimer1.address)
    claimer2_eth_balance = web3.eth.get_balance(claimer2.address)
    challenger_eth_balance = web3.eth.get_balance(challenger.address)

    token.mint(requester, transfer_amount, {"from": requester})
    assert token.balanceOf(requester) == transfer_amount
    assert token.balanceOf(claimer1) == 0
    assert token.balanceOf(claimer2) == 0
    assert token.balanceOf(request_manager.address) == 0

    assert web3.eth.get_balance(request_manager.address) == 0

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

    claim1_tx = request_manager.claimRequest(request_id, {"from": claimer1, "value": claim_stake})
    claim1_id = claim1_tx.return_value

    claim2_tx = request_manager.claimRequest(request_id, {"from": claimer2, "value": claim_stake})
    claim2_id = claim2_tx.return_value

    assert web3.eth.get_balance(claimer1.address) == claimer1_eth_balance - claim_stake
    assert web3.eth.get_balance(claimer2.address) == claimer2_eth_balance - claim_stake
    assert web3.eth.get_balance(challenger.address) == challenger_eth_balance

    request_manager.challengeClaim(claim1_id, {"from": challenger, "value": claim_stake + 1})

    assert web3.eth.get_balance(claimer1.address) == claimer1_eth_balance - claim_stake
    assert web3.eth.get_balance(claimer2.address) == claimer2_eth_balance - claim_stake
    assert web3.eth.get_balance(challenger.address) == challenger_eth_balance - claim_stake - 1

    # Withdraw must fail when claim pariod is not over
    with brownie.reverts("Challenge period not finished"):
        request_manager.withdraw(claim1_id, {"from": claimer1})

    # Timetravel after claim period
    chain.mine(timedelta=claim_period + challenge_period)

    assert token.balanceOf(request_manager.address) == transfer_amount
    assert web3.eth.get_balance(request_manager.address) == 3 * claim_stake + 1

    # The first claim gets withdrawn first
    # As the challenger wins, no requests funds must be paid out
    withdraw1_tx = request_manager.withdraw(claim1_id, {"from": requester})
    assert "ClaimWithdrawn" not in withdraw1_tx.events

    assert token.balanceOf(requester) == 0
    assert token.balanceOf(claimer1) == 0
    assert token.balanceOf(claimer2) == 0
    assert token.balanceOf(request_manager.address) == transfer_amount

    assert web3.eth.get_balance(request_manager.address) == claim_stake
    assert web3.eth.get_balance(claimer1.address) == claimer1_eth_balance - claim_stake
    assert web3.eth.get_balance(claimer2.address) == claimer2_eth_balance - claim_stake
    assert web3.eth.get_balance(challenger.address) == challenger_eth_balance + claim_stake

    # Another withdraw must fail
    with brownie.reverts("Claim already withdrawn"):
        request_manager.withdraw(claim1_id, {"from": claimer1})

    # The other claim must be withdrawable, but mustn't transfer the request tokens again
    withdraw2_tx = request_manager.withdraw(claim2_id, {"from": requester})
    assert "ClaimWithdrawn" in withdraw2_tx.events

    assert token.balanceOf(requester) == 0
    assert token.balanceOf(claimer1) == 0
    assert token.balanceOf(claimer2) == transfer_amount
    assert token.balanceOf(request_manager.address) == 0

    assert web3.eth.get_balance(request_manager.address) == 0
    assert web3.eth.get_balance(claimer1.address) == claimer1_eth_balance - claim_stake
    assert web3.eth.get_balance(claimer2.address) == claimer2_eth_balance
    assert web3.eth.get_balance(challenger.address) == challenger_eth_balance + claim_stake


def test_claim_after_withdraw(request_manager, token, claim_stake, claim_period):
    """Test that the same account can not claim a already withdrawn fill again"""
    requester = accounts[1]
    claimer = accounts[2]

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
    claim_tx = request_manager.claimRequest(request_id, {"from": claimer, "value": claim_stake})
    claim_id = claim_tx.return_value

    # Timetravel after claim period
    chain.mine(timedelta=claim_period)
    withdraw_tx = request_manager.withdraw(claim_id, {"from": claimer})
    assert "ClaimWithdrawn" in withdraw_tx.events

    # Claiming the same request again must fail
    with brownie.reverts("Deposit already withdrawn"):
        request_manager.claimRequest(request_id, {"from": claimer, "value": claim_stake})
