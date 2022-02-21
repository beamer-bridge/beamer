import brownie
from brownie import chain, web3
from brownie.convert import to_bytes
from eth_utils import to_hex

from contracts.tests.utils import alloc_accounts, create_fill_hash, make_request


def test_claim(token, request_manager, claim_stake):
    """Test that making a claim creates correct claim and emits event"""
    (requester,) = alloc_accounts(1)
    request_id = make_request(request_manager, token=token, requester=requester, amount=1)
    fill_id = to_bytes(b"123")
    claim_tx = request_manager.claimRequest(
        request_id, fill_id, {"from": requester, "value": claim_stake}
    )
    claim_id = claim_tx.return_value
    expected_termination = (
        request_manager.claimPeriod() + web3.eth.get_block("latest")["timestamp"]
    )

    assert "ClaimMade" in claim_tx.events
    claim_event = claim_tx.events["ClaimMade"]
    assert claim_event["requestId"] == request_id
    assert claim_event["claimId"] == claim_id
    assert claim_event["claimer"] == requester
    assert claim_event["claimerStake"] == claim_stake
    assert claim_event["challenger"] == brownie.ZERO_ADDRESS
    assert claim_event["termination"] == expected_termination
    assert claim_event["fillId"] == to_hex(fill_id)


def test_claim_with_different_stakes(token, request_manager, claim_stake):
    """Test that only claims with the correct stake can be submitted"""
    (requester,) = alloc_accounts(1)
    request_id = make_request(request_manager, token, requester, 1)

    claim = request_manager.claimRequest(request_id, 0, {"from": requester, "value": claim_stake})
    assert "ClaimMade" in claim.events

    with brownie.reverts("Invalid stake amount"):
        request_manager.claimRequest(request_id, 0, {"from": requester, "value": claim_stake - 1})

    with brownie.reverts("Invalid stake amount"):
        request_manager.claimRequest(request_id, 0, {"from": requester, "value": claim_stake + 1})

    with brownie.reverts("Invalid stake amount"):
        request_manager.claimRequest(request_id, 0, {"from": requester})


def test_claim_challenge(request_manager, token, claim_stake):
    """Test challenging a claim"""
    (requester,) = alloc_accounts(1)
    request_id = make_request(request_manager, token, requester, 1)

    claim = request_manager.claimRequest(request_id, 0, {"from": requester, "value": claim_stake})

    (challenger,) = alloc_accounts(1)
    with brownie.reverts("Not enough stake provided"):
        request_manager.challengeClaim(
            claim.return_value, {"from": challenger, "value": claim_stake}
        )

    with brownie.reverts("Not enough stake provided"):
        request_manager.challengeClaim(claim.return_value, {"from": challenger})

    # Do a proper challenge
    challenge = request_manager.challengeClaim(
        claim.return_value, {"from": challenger, "value": claim_stake + 1}
    )
    assert "ClaimMade" in challenge.events

    with brownie.reverts("Not eligible to outbid"):
        request_manager.challengeClaim(
            claim.return_value, {"from": challenger, "value": claim_stake + 1}
        )


def test_claim_counter_challenge(request_manager, token, claim_stake):
    """Test counter-challenging a challenge"""
    claimer, challenger, requester = alloc_accounts(3)
    request_id = make_request(request_manager, token, requester, 1)

    claim = request_manager.claimRequest(request_id, 0, {"from": claimer, "value": claim_stake})
    claim_id = claim.return_value

    with brownie.reverts("Not enough stake provided"):
        request_manager.challengeClaim(claim_id, {"from": requester, "value": claim_stake})

    # Do a proper challenge
    request_manager.challengeClaim(claim_id, {"from": challenger, "value": claim_stake + 1})

    # Another party must not be able to join the challenge game
    with brownie.reverts("Not eligible to outbid"):
        request_manager.challengeClaim(claim_id, {"from": requester})

    # The sender of the last challenge must not be able to challenge again
    with brownie.reverts("Not eligible to outbid"):
        request_manager.challengeClaim(claim_id, {"from": challenger})

    # The other party must be able to re-challenge
    outbid = request_manager.challengeClaim(claim_id, {"from": claimer, "value": 2})
    assert "ClaimMade" in outbid.events

    # Check that the roles are reversed now
    with brownie.reverts("Not eligible to outbid"):
        request_manager.challengeClaim(claim_id, {"from": claimer, "value": 1})

    # The other party must be able to re-challenge, but must increase the stake
    with brownie.reverts("Not enough stake provided"):
        request_manager.challengeClaim(claim_id, {"from": challenger, "value": 1})
    request_manager.challengeClaim(claim_id, {"from": challenger, "value": 2})


def test_claim_period_extension(
    request_manager, token, claim_stake, claim_period, challenge_period, challenge_period_extension
):
    """Test the extension of the claim/challenge period"""
    claimer, challenger, requester = alloc_accounts(3)
    request_id = make_request(request_manager, token, requester, 1)

    claim = request_manager.claimRequest(request_id, 0, {"from": claimer, "value": claim_stake})
    claim_id = claim.return_value

    assert claim.timestamp + claim_period == request_manager.claims(claim_id)[6]

    challenge = request_manager.challengeClaim(
        claim_id, {"from": challenger, "value": claim_stake + 1}
    )
    assert challenge.timestamp + challenge_period == request_manager.claims(claim_id)[6]

    # Another challenge with big margin to the end of the termination
    # shouldn't increase the termination
    request_manager.challengeClaim(claim_id, {"from": claimer, "value": 2})
    assert challenge.timestamp + challenge_period == request_manager.claims(claim_id)[6]

    # Timetravel close to end of challenge period
    chain.mine(timedelta=challenge_period * 8 / 10)
    rechallenge = request_manager.challengeClaim(claim_id, {"from": challenger, "value": 2})
    assert (
        rechallenge.timestamp + challenge_period_extension == request_manager.claims(claim_id)[6]
    )

    # Timetravel over the end of challenge period
    chain.mine(timedelta=challenge_period_extension)
    with brownie.reverts("Claim expired"):
        request_manager.challengeClaim(claim_id, {"from": claimer, "value": 2})


def test_withdraw_nonexistent_claim(request_manager):
    """Test withdrawing a non-existent claim"""
    with brownie.reverts("claimId not valid"):
        request_manager.withdraw(1234, {"from": alloc_accounts(1)[0]})


def test_claim_nonexistent_request(request_manager):
    """Test claiming a non-existent request"""
    with brownie.reverts("requestId not valid"):
        request_manager.claimRequest(1234, 0, {"from": alloc_accounts(1)[0]})


def test_withdraw_without_challenge(request_manager, token, claim_stake, claim_period):
    """Test withdraw when a claim was not challenged"""
    requester, claimer = alloc_accounts(2)
    transfer_amount = 23

    claimer_eth_balance = web3.eth.get_balance(claimer.address)

    token.mint(requester, transfer_amount, {"from": requester})
    assert token.balanceOf(requester) == transfer_amount
    assert token.balanceOf(claimer) == 0

    assert web3.eth.get_balance(request_manager.address) == 0

    request_id = make_request(request_manager, token, requester, transfer_amount)
    claim_tx = request_manager.claimRequest(request_id, 0, {"from": claimer, "value": claim_stake})
    claim_id = claim_tx.return_value

    assert web3.eth.get_balance(request_manager.address) == claim_stake
    assert web3.eth.get_balance(claimer.address) == claimer_eth_balance - claim_stake

    # Withdraw must fail when claim period is not over
    with brownie.reverts("Claim period not finished"):
        request_manager.withdraw(claim_id, {"from": claimer})

    # Timetravel after claim period
    chain.mine(timedelta=claim_period)

    # Even if the requester calls withdraw, the deposit goes to the claimer
    withdraw_tx = request_manager.withdraw(claim_id, {"from": requester})
    assert "DepositWithdrawn" in withdraw_tx.events
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

    requester, claimer, challenger = alloc_accounts(3)
    transfer_amount = 23

    claimer_eth_balance = web3.eth.get_balance(claimer.address)
    challenger_eth_balance = web3.eth.get_balance(challenger.address)

    token.mint(requester, transfer_amount, {"from": requester})
    assert token.balanceOf(requester) == transfer_amount
    assert token.balanceOf(claimer) == 0
    assert token.balanceOf(challenger) == 0

    assert web3.eth.get_balance(request_manager.address) == 0

    request_id = make_request(request_manager, token, requester, transfer_amount)
    claim_tx = request_manager.claimRequest(request_id, 0, {"from": claimer, "value": claim_stake})
    claim_id = claim_tx.return_value

    assert token.balanceOf(request_manager.address) == transfer_amount

    assert web3.eth.get_balance(claimer.address) == claimer_eth_balance - claim_stake
    assert web3.eth.get_balance(challenger.address) == challenger_eth_balance

    request_manager.challengeClaim(claim_id, {"from": challenger, "value": claim_stake + 1})

    assert web3.eth.get_balance(claimer.address) == claimer_eth_balance - claim_stake
    assert web3.eth.get_balance(challenger.address) == challenger_eth_balance - claim_stake - 1

    # Withdraw must fail when claim period is not over
    with brownie.reverts("Claim period not finished"):
        request_manager.withdraw(claim_id, {"from": claimer})

    # Timetravel after claim period
    chain.mine(timedelta=challenge_period)

    assert web3.eth.get_balance(request_manager.address) == 2 * claim_stake + 1

    # The challenger sent the last bet
    # Even if the requester calls withdraw, the challenge stakes go to the challenger
    # However, the request funds stay in the contract
    withdraw_tx = request_manager.withdraw(claim_id, {"from": requester})
    assert "ClaimWithdrawn" in withdraw_tx.events
    assert "DepositWithdrawn" not in withdraw_tx.events

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
    requester, claimer1, claimer2 = alloc_accounts(3)
    transfer_amount = 23

    claimer1_eth_balance = web3.eth.get_balance(claimer1.address)
    claimer2_eth_balance = web3.eth.get_balance(claimer2.address)

    token.mint(requester, transfer_amount, {"from": requester})
    assert token.balanceOf(requester) == transfer_amount
    assert token.balanceOf(claimer1) == 0
    assert token.balanceOf(claimer2) == 0

    assert web3.eth.get_balance(request_manager.address) == 0

    request_id = make_request(request_manager, token, requester, transfer_amount)

    claim1_tx = request_manager.claimRequest(
        request_id, 0, {"from": claimer1, "value": claim_stake}
    )
    claim1_id = claim1_tx.return_value

    claim2_tx = request_manager.claimRequest(
        request_id, 0, {"from": claimer2, "value": claim_stake}
    )
    claim2_id = claim2_tx.return_value

    assert web3.eth.get_balance(claimer1.address) == claimer1_eth_balance - claim_stake
    assert web3.eth.get_balance(claimer2.address) == claimer2_eth_balance - claim_stake

    # Withdraw must fail when claim period is not over
    with brownie.reverts("Claim period not finished"):
        request_manager.withdraw(claim1_id, {"from": claimer1})

    # Timetravel after claim period
    chain.mine(timedelta=claim_period)

    assert web3.eth.get_balance(request_manager.address) == 2 * claim_stake

    # The first claim gets withdrawn first
    # Even if the requester calls withdraw, the deposit goes to the claimer1
    withdraw1_tx = request_manager.withdraw(claim1_id, {"from": requester})
    assert "DepositWithdrawn" in withdraw1_tx.events
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

    # The other claim must be withdrawable, but the claim stakes go to the platform
    # as it is a false claim but no challenger exists
    withdraw2_tx = request_manager.withdraw(claim2_id, {"from": requester})
    assert "DepositWithdrawn" not in withdraw2_tx.events
    assert "ClaimWithdrawn" in withdraw2_tx.events

    assert token.balanceOf(requester) == 0
    assert token.balanceOf(claimer1) == transfer_amount
    assert token.balanceOf(claimer2) == 0

    # Since there was no challenger, but claim2 was a false claim, stakes go to the platform
    assert (
        web3.eth.get_balance(request_manager.address)
        == request_manager.collectedRaisyncFees()
        == claim_stake
    )
    assert web3.eth.get_balance(claimer1.address) == claimer1_eth_balance
    assert web3.eth.get_balance(claimer2.address) == claimer2_eth_balance - claim_stake


def test_withdraw_with_two_claims_and_challenge(request_manager, token, claim_stake, claim_period):
    """Test withdraw when a request was claimed twice and challenged"""
    requester, claimer1, claimer2, challenger = alloc_accounts(4)
    transfer_amount = 23

    claimer1_eth_balance = web3.eth.get_balance(claimer1.address)
    claimer2_eth_balance = web3.eth.get_balance(claimer2.address)
    challenger_eth_balance = web3.eth.get_balance(challenger.address)

    token.mint(requester, transfer_amount, {"from": requester})
    assert token.balanceOf(requester) == transfer_amount
    assert token.balanceOf(claimer1) == 0
    assert token.balanceOf(claimer2) == 0

    assert web3.eth.get_balance(request_manager.address) == 0

    request_id = make_request(request_manager, token, requester, transfer_amount)

    claim1_tx = request_manager.claimRequest(
        request_id, 0, {"from": claimer1, "value": claim_stake}
    )
    claim1_id = claim1_tx.return_value

    claim2_tx = request_manager.claimRequest(
        request_id, 0, {"from": claimer2, "value": claim_stake}
    )
    claim2_id = claim2_tx.return_value

    assert web3.eth.get_balance(claimer1.address) == claimer1_eth_balance - claim_stake
    assert web3.eth.get_balance(claimer2.address) == claimer2_eth_balance - claim_stake
    assert web3.eth.get_balance(challenger.address) == challenger_eth_balance

    request_manager.challengeClaim(claim2_id, {"from": challenger, "value": claim_stake + 1})

    assert web3.eth.get_balance(claimer1.address) == claimer1_eth_balance - claim_stake
    assert web3.eth.get_balance(claimer2.address) == claimer2_eth_balance - claim_stake
    assert web3.eth.get_balance(challenger.address) == challenger_eth_balance - claim_stake - 1

    # Withdraw must fail when claim period is not over
    with brownie.reverts("Claim period not finished"):
        request_manager.withdraw(claim1_id, {"from": claimer1})

    # Timetravel after claim period
    chain.mine(timedelta=claim_period)

    assert web3.eth.get_balance(request_manager.address) == 3 * claim_stake + 1

    # The first claim gets withdrawn first
    # Even if the requester calls withdraw, the deposit goes to the claimer1
    withdraw1_tx = request_manager.withdraw(claim1_id, {"from": requester})
    assert "DepositWithdrawn" in withdraw1_tx.events
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
    requester, claimer1, claimer2, challenger = alloc_accounts(4)
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

    request_id = make_request(request_manager, token, requester, transfer_amount)

    claim1_tx = request_manager.claimRequest(
        request_id, 0, {"from": claimer1, "value": claim_stake}
    )
    claim1_id = claim1_tx.return_value

    claim2_tx = request_manager.claimRequest(
        request_id, 0, {"from": claimer2, "value": claim_stake}
    )
    claim2_id = claim2_tx.return_value

    assert web3.eth.get_balance(claimer1.address) == claimer1_eth_balance - claim_stake
    assert web3.eth.get_balance(claimer2.address) == claimer2_eth_balance - claim_stake
    assert web3.eth.get_balance(challenger.address) == challenger_eth_balance

    request_manager.challengeClaim(claim1_id, {"from": challenger, "value": claim_stake + 1})

    assert web3.eth.get_balance(claimer1.address) == claimer1_eth_balance - claim_stake
    assert web3.eth.get_balance(claimer2.address) == claimer2_eth_balance - claim_stake
    assert web3.eth.get_balance(challenger.address) == challenger_eth_balance - claim_stake - 1

    # Withdraw must fail when claim period is not over
    with brownie.reverts("Claim period not finished"):
        request_manager.withdraw(claim1_id, {"from": claimer1})

    # Timetravel after claim period
    chain.mine(timedelta=claim_period + challenge_period)

    assert token.balanceOf(request_manager.address) == transfer_amount
    assert web3.eth.get_balance(request_manager.address) == 3 * claim_stake + 1

    # The first claim gets withdrawn first
    # As the challenger wins, no requests funds must be paid out
    withdraw1_tx = request_manager.withdraw(claim1_id, {"from": requester})
    assert "DepositWithdrawn" not in withdraw1_tx.events

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
    requester, claimer = alloc_accounts(2)
    request_id = make_request(request_manager, token, requester, 23)

    claim_tx = request_manager.claimRequest(request_id, 0, {"from": claimer, "value": claim_stake})
    claim_id = claim_tx.return_value

    # Timetravel after claim period
    chain.mine(timedelta=claim_period)
    withdraw_tx = request_manager.withdraw(claim_id, {"from": claimer})
    assert "DepositWithdrawn" in withdraw_tx.events
    assert "ClaimWithdrawn" in withdraw_tx.events

    # Claiming the same request again must fail
    with brownie.reverts("Deposit already withdrawn"):
        request_manager.claimRequest(request_id, 0, {"from": claimer, "value": claim_stake})


def test_second_claim_after_withdraw(request_manager, token, claim_stake, claim_period):
    """Test that one can withdraw a claim immediately after the request
    deposit has been withdrawn via another claim."""
    requester, claimer1, claimer2 = alloc_accounts(3)
    request_id = make_request(request_manager, token, requester, 23)

    claimer1_eth_balance = web3.eth.get_balance(claimer1.address)
    claimer2_eth_balance = web3.eth.get_balance(claimer2.address)

    claim1_tx = request_manager.claimRequest(
        request_id, 0, {"from": claimer1, "value": claim_stake}
    )
    claim1_id = claim1_tx.return_value

    # Timetravel after claim period / 2.
    chain.mine(timedelta=claim_period / 2)
    claim2_tx = request_manager.claimRequest(
        request_id, 0, {"from": claimer2, "value": claim_stake}
    )
    claim2_id = claim2_tx.return_value

    # Another claim from the future depositReceiver
    claim3_tx = request_manager.claimRequest(
        request_id, 0, {"from": claimer1, "value": claim_stake}
    )
    claim3_id = claim3_tx.return_value

    # Timetravel after claim period / 2. At this point claim 1 can be
    # withdrawn (its claim period is over), but not claim 2 (its claim period
    # is not over yet).
    chain.mine(timedelta=claim_period / 2)
    withdraw_tx = request_manager.withdraw(claim1_id, {"from": claimer1})
    assert "DepositWithdrawn" in withdraw_tx.events
    assert "ClaimWithdrawn" in withdraw_tx.events
    assert claimer1_eth_balance - claim_stake == web3.eth.get_balance(claimer1.address)

    # Withdrawing the second claim must now succeed immediately because the
    # deposit has been withdrawn and we do not need to wait for the claim
    # period. The stakes go to the platform fees
    withdraw_tx = request_manager.withdraw(claim2_id, {"from": claimer2})
    assert "ClaimWithdrawn" in withdraw_tx.events
    assert claimer2_eth_balance - claim_stake == web3.eth.get_balance(claimer2.address)
    assert claim_stake == request_manager.collectedRaisyncFees()

    # Withdrawing the third claim must also succeed immediately.
    # Since the claimer is also the depositReiceiver stakes go back to the claimer
    withdraw_tx = request_manager.withdraw(claim3_id, {"from": claimer1})
    assert "ClaimWithdrawn" in withdraw_tx.events
    assert claimer1_eth_balance == web3.eth.get_balance(claimer1.address)


def test_withdraw_without_challenge_with_resolution(
    request_manager, resolution_registry, token, claim_stake, contracts
):
    """Test withdraw when a claim was not challenged, but L1 resolved"""
    requester, claimer = alloc_accounts(2)
    transfer_amount = 23

    claimer_eth_balance = web3.eth.get_balance(claimer.address)

    token.mint(requester, transfer_amount, {"from": requester})
    assert token.balanceOf(requester) == transfer_amount
    assert token.balanceOf(claimer) == 0

    assert web3.eth.get_balance(request_manager.address) == 0

    request_id = make_request(request_manager, token, requester, transfer_amount)
    fill_id = to_bytes(b"123")
    claim_tx = request_manager.claimRequest(
        request_id, fill_id, {"from": claimer, "value": claim_stake}
    )
    claim_id = claim_tx.return_value

    assert web3.eth.get_balance(request_manager.address) == claim_stake
    assert web3.eth.get_balance(claimer.address) == claimer_eth_balance - claim_stake

    fill_hash = create_fill_hash(
        request_id,
        web3.eth.chain_id,
        web3.eth.chain_id,
        token.address,
        requester.address,
        transfer_amount,
        fill_id,
    )

    # Register a L1 resolution
    contracts.messenger2.setLastSender(contracts.resolver.address)
    resolution_registry.resolveRequest(
        fill_hash, web3.eth.chain_id, claimer.address, {"from": contracts.messenger2}
    )

    # The claim period is not over, but the resolution must allow withdrawal now
    withdraw_tx = request_manager.withdraw(claim_id, {"from": claimer})
    assert "DepositWithdrawn" in withdraw_tx.events
    assert "ClaimWithdrawn" in withdraw_tx.events

    assert token.balanceOf(requester) == 0
    assert token.balanceOf(claimer) == transfer_amount

    assert web3.eth.get_balance(request_manager.address) == 0
    assert web3.eth.get_balance(claimer.address) == claimer_eth_balance

    # Another withdraw must fail
    with brownie.reverts("Claim already withdrawn"):
        request_manager.withdraw(claim_id, {"from": claimer})


def test_withdraw_expired(token, request_manager):
    """Test that a request can be withdrawn once it is expired"""
    validity_period = 60
    (requester,) = alloc_accounts(1)

    amount = 17
    token.mint(requester, amount)

    request_id = make_request(
        request_manager, token, requester, amount, validity_period=validity_period
    )

    assert token.balanceOf(requester) == 0

    chain.mine(timedelta=validity_period)
    tx = request_manager.withdrawExpiredRequest(request_id, {"from": requester})
    assert "DepositWithdrawn" in tx.events
    assert token.balanceOf(requester) == amount


def test_withdraw_before_expiration(token, request_manager):
    """Test that a request cannot be withdrawn before it is expired"""
    validity_period = 60
    (requester,) = alloc_accounts(1)

    request_id = make_request(
        request_manager, token, requester, 1, validity_period=validity_period
    )

    chain.mine(timedelta=validity_period / 2)
    with brownie.reverts("Request not expired yet"):
        request_manager.withdrawExpiredRequest(request_id, {"from": requester})
