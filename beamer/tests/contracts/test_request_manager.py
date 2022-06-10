import brownie
import pytest
from brownie import chain, web3
from brownie.convert import to_bytes
from eth_utils import to_hex

from beamer.tests.agent.utils import make_address
from beamer.tests.constants import FILL_ID, RM_C_FIELD_TERMINATION
from beamer.tests.util import (
    alloc_accounts,
    create_fill_hash,
    create_request_hash,
    earnings,
    make_request,
)
from beamer.typing import ClaimId, FillId, Termination


def test_request_invalid_target_chain(request_manager, token):
    (requester,) = alloc_accounts(1)
    with brownie.reverts("Target rollup not supported"):
        make_request(
            request_manager,
            target_chain_id=999,
            token=token,
            requester=requester,
            target_address=requester,
            amount=1,
        )

    assert request_manager.requestCounter() == 0
    make_request(
        request_manager,
        target_chain_id=web3.eth.chain_id,
        token=token,
        requester=requester,
        target_address=requester,
        amount=1,
    )
    assert request_manager.requestCounter() == 1


def test_claim(token, request_manager, claim_stake):
    """Test that making a claim creates correct claim and emits event"""
    (requester,) = alloc_accounts(1)
    request_id = make_request(
        request_manager, token=token, requester=requester, target_address=requester, amount=1
    )

    claim_tx = request_manager.claimRequest(
        request_id, FILL_ID, {"from": requester, "value": claim_stake}
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
    assert claim_event["lastChallenger"] == brownie.ZERO_ADDRESS
    assert claim_event["challengerStakeTotal"] == 0
    assert claim_event["termination"] == expected_termination
    assert claim_event["fillId"] == to_hex(FILL_ID)


def test_claim_with_different_stakes(token, request_manager, claim_stake):
    """Test that only claims with the correct stake can be submitted"""
    (requester,) = alloc_accounts(1)
    request_id = make_request(request_manager, token, requester, requester, 1)

    claim = request_manager.claimRequest(
        request_id, FILL_ID, {"from": requester, "value": claim_stake}
    )
    assert "ClaimMade" in claim.events

    with brownie.reverts("Invalid stake amount"):
        request_manager.claimRequest(
            request_id, FILL_ID, {"from": requester, "value": claim_stake - 1}
        )

    with brownie.reverts("Invalid stake amount"):
        request_manager.claimRequest(
            request_id, FILL_ID, {"from": requester, "value": claim_stake + 1}
        )

    with brownie.reverts("Invalid stake amount"):
        request_manager.claimRequest(request_id, FILL_ID, {"from": requester})


def test_claim_challenge(request_manager, token, claim_stake):
    """Test challenging a claim"""
    requester, challenger = alloc_accounts(2)
    request_id = make_request(request_manager, token, requester, requester, 1)

    claim = request_manager.claimRequest(
        request_id, FILL_ID, {"from": requester, "value": claim_stake}
    )

    with brownie.reverts("Not enough stake provided"):
        request_manager.challengeClaim(
            claim.return_value, {"from": challenger, "value": claim_stake}
        )

    with brownie.reverts("Cannot challenge own claim"):
        request_manager.challengeClaim(
            claim.return_value, {"from": requester, "value": claim_stake + 1}
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
    request_id = make_request(request_manager, token, requester, requester, 1)

    claim = request_manager.claimRequest(
        request_id, FILL_ID, {"from": claimer, "value": claim_stake}
    )
    claim_id = claim.return_value

    with brownie.reverts("Not enough stake provided"):
        request_manager.challengeClaim(claim_id, {"from": requester, "value": claim_stake})

    # Do a proper challenge
    request_manager.challengeClaim(claim_id, {"from": challenger, "value": claim_stake + 1})

    # Only the claimer is eligible to outbid the challengers
    with brownie.reverts("Not eligible to outbid"):
        request_manager.challengeClaim(claim_id, {"from": requester})

    # The sender of the last challenge must not be able to challenge again
    with brownie.reverts("Not eligible to outbid"):
        request_manager.challengeClaim(claim_id, {"from": challenger})

    # The other party, in this case the claimer, must be able to re-challenge
    with brownie.reverts("Not enough stake provided"):
        request_manager.challengeClaim(claim_id, {"from": claimer, "value": claim_stake})
    outbid = request_manager.challengeClaim(claim_id, {"from": claimer, "value": claim_stake + 1})
    assert "ClaimMade" in outbid.events

    # Check that claimer is leading and cannot challenge own claim
    with brownie.reverts("Cannot challenge own claim"):
        request_manager.challengeClaim(claim_id, {"from": claimer, "value": 1})

    # The challenger must be able to re-challenge, but must increase the stake
    with brownie.reverts("Not enough stake provided"):
        request_manager.challengeClaim(claim_id, {"from": challenger, "value": claim_stake})
    outbid = request_manager.challengeClaim(
        claim_id, {"from": challenger, "value": claim_stake + 1}
    )
    assert "ClaimMade" in outbid.events


def test_claim_two_challengers(request_manager, token, claim_stake):
    """Test that two different challengers can challenge"""
    claimer, first_challenger, second_challenger, requester = alloc_accounts(4)
    request_id = make_request(request_manager, token, requester, requester, 1)

    claim = request_manager.claimRequest(
        request_id, FILL_ID, {"from": claimer, "value": claim_stake}
    )
    claim_id = claim.return_value

    # First challenger challenges
    outbid = request_manager.challengeClaim(
        claim_id, {"from": first_challenger, "value": claim_stake + 1}
    )
    assert "ClaimMade" in outbid.events

    # Claimer outbids again
    outbid = request_manager.challengeClaim(claim_id, {"from": claimer, "value": claim_stake + 1})
    assert "ClaimMade" in outbid.events

    # Check that claimer cannot be second challenger
    with brownie.reverts("Cannot challenge own claim"):
        request_manager.challengeClaim(claim_id, {"from": claimer, "value": claim_stake + 1})

    # Second challenger challenges
    outbid = request_manager.challengeClaim(
        claim_id, {"from": second_challenger, "value": claim_stake + 1}
    )
    assert "ClaimMade" in outbid.events


def test_claim_period_extension(
    request_manager,
    token,
    claim_stake,
    claim_period,
    finalization_time,
    challenge_period_extension,
):
    """Test the extension of the claim/challenge period"""
    claimer, challenger, requester = alloc_accounts(3)
    request_id = make_request(request_manager, token, requester, requester, 1)

    claim = request_manager.claimRequest(
        request_id, FILL_ID, {"from": claimer, "value": claim_stake}
    )
    claim_id = claim.return_value

    def _get_claim_termination(_claim_id: ClaimId) -> Termination:
        return request_manager.claims(_claim_id)[RM_C_FIELD_TERMINATION]

    assert claim.timestamp + claim_period == _get_claim_termination(claim_id)

    challenge = request_manager.challengeClaim(
        claim_id, {"from": challenger, "value": claim_stake + 1}
    )
    challenge_period = finalization_time + challenge_period_extension

    claim_termination = _get_claim_termination(claim_id)
    assert challenge.timestamp + challenge_period == claim_termination

    # Another challenge with big margin to the end of the termination
    # shouldn't increase the termination
    request_manager.challengeClaim(claim_id, {"from": claimer, "value": claim_stake + 1})

    assert claim_termination == _get_claim_termination(claim_id)

    # Another challenge by challenger also shouldn't increase the end of termination
    request_manager.challengeClaim(claim_id, {"from": challenger, "value": claim_stake + 1})
    assert claim_termination == _get_claim_termination(claim_id)

    # Timetravel close to end of challenge period
    chain.mine(timestamp=_get_claim_termination(claim_id) - 10)

    old_claim_termination = claim_termination
    # Claimer challenges close to the end of challenge
    # Should increase the challenge termination
    challenge = request_manager.challengeClaim(
        claim_id, {"from": claimer, "value": claim_stake + 1}
    )

    new_claim_termination = _get_claim_termination(claim_id)
    assert challenge.timestamp + challenge_period_extension == new_claim_termination
    assert new_claim_termination > old_claim_termination

    # Timetravel close to end of challenge period
    chain.mine(timestamp=_get_claim_termination(claim_id) - 10)

    old_claim_termination = new_claim_termination
    rechallenge = request_manager.challengeClaim(
        claim_id, {"from": challenger, "value": claim_stake + 1}
    )
    new_claim_termination = _get_claim_termination(claim_id)
    assert rechallenge.timestamp + challenge_period_extension == new_claim_termination
    assert new_claim_termination > old_claim_termination

    # Timetravel over the end of challenge period
    chain.mine(timestamp=_get_claim_termination(claim_id) + 1)

    with brownie.reverts("Claim expired"):
        request_manager.challengeClaim(claim_id, {"from": claimer, "value": claim_stake + 1})


def test_withdraw_nonexistent_claim(request_manager):
    """Test withdrawing a non-existent claim"""
    with brownie.reverts("claimId not valid"):
        request_manager.withdraw(1234, {"from": alloc_accounts(1)[0]})


def test_claim_nonexistent_request(request_manager):
    """Test claiming a non-existent request"""
    with brownie.reverts("requestId not valid"):
        request_manager.claimRequest(1234, FILL_ID, {"from": alloc_accounts(1)[0]})


def test_withdraw_without_challenge(request_manager, token, claim_stake, claim_period):
    """Test withdraw when a claim was not challenged"""
    requester, claimer = alloc_accounts(2)
    transfer_amount = 23

    claimer_eth_balance = web3.eth.get_balance(claimer.address)

    token.mint(requester, transfer_amount, {"from": requester})
    assert token.balanceOf(requester) == transfer_amount
    assert token.balanceOf(claimer) == 0

    assert web3.eth.get_balance(request_manager.address) == 0

    request_id = make_request(request_manager, token, requester, requester, transfer_amount)
    claim_tx = request_manager.claimRequest(
        request_id, FILL_ID, {"from": claimer, "value": claim_stake}
    )
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


def test_withdraw_with_challenge(
    request_manager, token, claim_stake, finalization_time, challenge_period_extension
):
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

    request_id = make_request(request_manager, token, requester, requester, transfer_amount)
    claim_tx = request_manager.claimRequest(
        request_id, FILL_ID, {"from": claimer, "value": claim_stake}
    )
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

    # Timetravel after challenge period
    chain.mine(timedelta=finalization_time + challenge_period_extension)

    assert web3.eth.get_balance(request_manager.address) == 2 * claim_stake + 1

    # The challenger sent the last bid
    # Even if the requester calls withdraw, the challenge stakes go to the challenger
    # However, the request funds stay in the contract
    withdraw_tx = request_manager.withdraw(claim_id, {"from": challenger})
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


def test_withdraw_with_two_claims(deployer, request_manager, token, claim_stake, claim_period):
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

    request_id = make_request(request_manager, token, requester, requester, transfer_amount)

    claim1_tx = request_manager.claimRequest(
        request_id, FILL_ID, {"from": claimer1, "value": claim_stake}
    )
    claim1_id = claim1_tx.return_value

    claim2_tx = request_manager.claimRequest(
        request_id, FILL_ID, {"from": claimer2, "value": claim_stake}
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

    # The other claim must be withdrawable, but the claim stakes go to the
    # contract owner as it is a false claim but no challenger exists.
    with earnings(web3, deployer) as owner_earnings:
        withdraw2_tx = request_manager.withdraw(claim2_id, {"from": requester})
    assert "DepositWithdrawn" not in withdraw2_tx.events
    assert "ClaimWithdrawn" in withdraw2_tx.events

    assert token.balanceOf(requester) == 0
    assert token.balanceOf(claimer1) == transfer_amount
    assert token.balanceOf(claimer2) == 0

    # Since there was no challenger, but claim2 was a false claim,
    # stakes go to the contract owner.
    assert owner_earnings() == claim_stake
    assert web3.eth.get_balance(claimer1.address) == claimer1_eth_balance
    assert web3.eth.get_balance(claimer2.address) == claimer2_eth_balance - claim_stake


@pytest.mark.parametrize("second_fill_id", [FILL_ID, FillId(b"wrong_fill_id")])
def test_withdraw_second_claim_same_claimer_different_fill_ids(
    request_manager, token, claim_stake, claim_period, second_fill_id
):
    """
    Test withdraw with two claims by the same address. First one is successful.
    If the second fill id is also equal to the first, this is an identical claim.
    The claimer should also win.
    If the fill id is different the challenger must win,
    even though the claimer was successful with a different claim and fill id.
    """
    requester, claimer, challenger = alloc_accounts(3)
    transfer_amount = 23

    token.mint(requester, transfer_amount, {"from": requester})
    assert token.balanceOf(requester) == transfer_amount
    assert token.balanceOf(claimer) == 0

    request_id = make_request(request_manager, token, requester, requester, transfer_amount)

    claim1_tx = request_manager.claimRequest(
        request_id, FILL_ID, {"from": claimer, "value": claim_stake}
    )
    claim1_id = claim1_tx.return_value

    claim2_tx = request_manager.claimRequest(
        request_id, second_fill_id, {"from": claimer, "value": claim_stake}
    )
    claim2_id = claim2_tx.return_value

    challenger_eth_balance = web3.eth.get_balance(challenger.address)
    assert web3.eth.get_balance(challenger.address) == challenger_eth_balance
    request_manager.challengeClaim(claim2_id, {"from": challenger, "value": claim_stake + 1})
    assert web3.eth.get_balance(challenger.address) == challenger_eth_balance - claim_stake - 1

    # Withdraw must fail when claim period is not over
    with brownie.reverts("Claim period not finished"):
        request_manager.withdraw(claim1_id, {"from": claimer})
    # Withdraw must fail when claim period is not over
    with brownie.reverts("Claim period not finished"):
        request_manager.withdraw(claim2_id, {"from": claimer})

    # Timetravel after claim period
    chain.mine(timedelta=claim_period)

    # Withdraw must fail because it was challenged
    with brownie.reverts("Claim period not finished"):
        request_manager.withdraw(claim2_id, {"from": claimer})

    current_claimer_eth_balance = web3.eth.get_balance(claimer.address)

    withdraw_tx = request_manager.withdraw(claim1_id, {"from": claimer})
    assert "DepositWithdrawn" in withdraw_tx.events
    assert "ClaimWithdrawn" in withdraw_tx.events

    assert web3.eth.get_balance(claimer.address) == current_claimer_eth_balance + claim_stake
    assert token.balanceOf(claimer) == transfer_amount

    claim_winner = claimer if second_fill_id == FILL_ID else challenger
    claim_loser = challenger if claimer == claim_winner else claimer

    claim_winner_balance = web3.eth.get_balance(claim_winner.address)
    claim_loser_balance = web3.eth.get_balance(claim_loser.address)

    # Even though the challenge period of claim2 isn't over, the claim can be resolved now.
    withdraw_tx = request_manager.withdraw(claim2_id, {"from": claim_winner})
    assert "DepositWithdrawn" not in withdraw_tx.events
    assert "ClaimWithdrawn" in withdraw_tx.events

    assert web3.eth.get_balance(claim_winner.address) == claim_winner_balance + 2 * claim_stake + 1
    assert web3.eth.get_balance(claim_loser.address) == claim_loser_balance


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

    request_id = make_request(request_manager, token, requester, requester, transfer_amount)

    claim1_tx = request_manager.claimRequest(
        request_id, FILL_ID, {"from": claimer1, "value": claim_stake}
    )
    claim1_id = claim1_tx.return_value

    claim2_tx = request_manager.claimRequest(
        request_id, FILL_ID, {"from": claimer2, "value": claim_stake}
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
    request_manager.withdraw(claim2_id, {"from": challenger})

    assert token.balanceOf(requester) == 0
    assert token.balanceOf(claimer1) == transfer_amount
    assert token.balanceOf(claimer2) == 0

    assert web3.eth.get_balance(request_manager.address) == 0
    assert web3.eth.get_balance(claimer1.address) == claimer1_eth_balance
    assert web3.eth.get_balance(claimer2.address) == claimer2_eth_balance - claim_stake
    assert web3.eth.get_balance(challenger.address) == challenger_eth_balance + claim_stake


def test_withdraw_with_two_claims_first_unsuccessful_then_successful(
    request_manager, token, claim_stake, claim_period, finalization_time
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

    request_id = make_request(request_manager, token, requester, requester, transfer_amount)

    claim1_tx = request_manager.claimRequest(
        request_id, FILL_ID, {"from": claimer1, "value": claim_stake}
    )
    claim1_id = claim1_tx.return_value

    claim2_tx = request_manager.claimRequest(
        request_id, FILL_ID, {"from": claimer2, "value": claim_stake}
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
    chain.mine(timedelta=claim_period + finalization_time)

    assert token.balanceOf(request_manager.address) == transfer_amount
    assert web3.eth.get_balance(request_manager.address) == 3 * claim_stake + 1

    # The first claim gets withdrawn first
    # As the challenger wins, no requests funds must be paid out
    withdraw1_tx = request_manager.withdraw(claim1_id, {"from": challenger})
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
    request_id = make_request(request_manager, token, requester, requester, 23)

    claim_tx = request_manager.claimRequest(
        request_id, FILL_ID, {"from": claimer, "value": claim_stake}
    )
    claim_id = claim_tx.return_value

    # Timetravel after claim period
    chain.mine(timedelta=claim_period)
    withdraw_tx = request_manager.withdraw(claim_id, {"from": claimer})
    assert "DepositWithdrawn" in withdraw_tx.events
    assert "ClaimWithdrawn" in withdraw_tx.events

    # Claiming the same request again must fail
    with brownie.reverts("Deposit already withdrawn"):
        request_manager.claimRequest(request_id, FILL_ID, {"from": claimer, "value": claim_stake})


def test_second_claim_after_withdraw(deployer, request_manager, token, claim_stake, claim_period):
    """Test that one can withdraw a claim immediately after the request
    deposit has been withdrawn via another claim."""
    requester, claimer1, claimer2 = alloc_accounts(3)
    request_id = make_request(request_manager, token, requester, requester, 23)

    claimer1_eth_balance = web3.eth.get_balance(claimer1.address)
    claimer2_eth_balance = web3.eth.get_balance(claimer2.address)

    claim1_tx = request_manager.claimRequest(
        request_id, FILL_ID, {"from": claimer1, "value": claim_stake}
    )
    claim1_id = claim1_tx.return_value

    # Timetravel after claim period / 2.
    chain.mine(timedelta=claim_period / 2)
    claim2_tx = request_manager.claimRequest(
        request_id, FILL_ID, {"from": claimer2, "value": claim_stake}
    )
    claim2_id = claim2_tx.return_value

    # Another claim from the future depositReceiver
    claim3_tx = request_manager.claimRequest(
        request_id, FILL_ID, {"from": claimer1, "value": claim_stake}
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
    # period. The stakes go to the contract owner.
    with earnings(web3, deployer) as owner_earnings:
        withdraw_tx = request_manager.withdraw(claim2_id, {"from": claimer2})
    assert "ClaimWithdrawn" in withdraw_tx.events
    assert claimer2_eth_balance - claim_stake == web3.eth.get_balance(claimer2.address)
    assert owner_earnings() == claim_stake

    # Withdrawing the third claim must also succeed immediately.
    # Since the claimer is also the depositReceiver stakes go back to the claimer
    withdraw_tx = request_manager.withdraw(claim3_id, {"from": claimer1})
    assert "ClaimWithdrawn" in withdraw_tx.events
    assert claimer1_eth_balance == web3.eth.get_balance(claimer1.address)


@pytest.mark.parametrize("invalidate", [True, False])
@pytest.mark.parametrize("l1_filler", [make_address(), None])
def test_withdraw_without_challenge_with_resolution(
    request_manager, resolution_registry, token, claim_stake, contracts, invalidate, l1_filler
):
    """
    Test withdraw when a claim was not challenged, but L1 resolved
    It tests the combination of L1 resolution

    fill hash (invalid, valid)
            X
    l1 filler (honest claimer, dishonest claimer)

    In the invalid - dishonest claimer case, stakes go to the contract
    owner as there is no challenger
    In the invalid - honest claimer case, honest claimer reverts the
    invalidation in the resolution registry
    """
    requester, claimer = alloc_accounts(2)
    transfer_amount = 23

    if l1_filler is None:
        l1_filler = claimer.address

    token.mint(requester, transfer_amount, {"from": requester})

    # Initial balances
    claimer_eth_balance = web3.eth.get_balance(claimer.address)
    owner_eth_balance = web3.eth.get_balance(request_manager.owner())
    request_manager_balance = web3.eth.get_balance(request_manager.address)

    requester_token_balance = token.balanceOf(requester)
    claimer_token_balance = token.balanceOf(claimer)

    # If no claims exist or are fully withdrawn
    # there should be no ETH on the request manager contract
    assert web3.eth.get_balance(request_manager.address) == 0

    request_id = make_request(request_manager, token, requester, requester, transfer_amount)

    # Claim
    fill_id = to_bytes(b"123")
    claim_tx = request_manager.claimRequest(
        request_id, fill_id, {"from": claimer, "value": claim_stake}
    )
    claim_id = claim_tx.return_value

    assert web3.eth.get_balance(request_manager.address) == request_manager_balance + claim_stake
    assert web3.eth.get_balance(claimer.address) == claimer_eth_balance - claim_stake

    # Start L1 resolution
    request_hash = create_request_hash(
        request_id,
        web3.eth.chain_id,
        web3.eth.chain_id,
        token.address,
        requester.address,
        transfer_amount,
    )

    fill_hash = create_fill_hash(
        request_id,
        web3.eth.chain_id,
        web3.eth.chain_id,
        token.address,
        requester.address,
        transfer_amount,
        fill_id,
    )

    contracts.l1_messenger.setLastSender(contracts.resolver.address)

    if invalidate:
        resolution_registry.invalidateFillHash(
            request_hash, fill_id, chain.id, {"from": contracts.l1_messenger}
        )
    # Assert that invalidation works
    assert resolution_registry.invalidFillHashes(fill_hash) == invalidate

    # Register a L1 resolution
    resolution_registry.resolveRequest(
        request_hash, fill_id, web3.eth.chain_id, l1_filler, {"from": contracts.l1_messenger}
    )

    # Assert that correct filler is resolved, it reverts the false invalidation
    if invalidate and l1_filler == claimer:
        assert not resolution_registry.invalidFillHashes(fill_hash)

    # The claim period is not over, but the resolution must allow withdrawal now
    withdraw_tx = request_manager.withdraw(claim_id, {"from": claimer})

    if claimer == l1_filler:
        assert "DepositWithdrawn" in withdraw_tx.events
        assert token.balanceOf(requester) == requester_token_balance - transfer_amount
        assert token.balanceOf(claimer) == claimer_token_balance + transfer_amount

    else:
        claimer_eth_balance -= claim_stake
        owner_eth_balance += claim_stake

    assert "ClaimWithdrawn" in withdraw_tx.events

    assert web3.eth.get_balance(request_manager.owner()) == owner_eth_balance
    assert web3.eth.get_balance(claimer.address) == claimer_eth_balance
    assert web3.eth.get_balance(request_manager.address) == request_manager_balance

    # Another withdraw must fail
    with brownie.reverts("Claim already withdrawn"):
        request_manager.withdraw(claim_id, {"from": claimer})


def test_withdraw_l1_resolved_muliple_claims(
    contracts, request_manager, resolution_registry, token, claim_stake
):
    requester, first_claimer, second_claimer = alloc_accounts(3)
    transfer_amount = 23
    token.mint(requester, transfer_amount, {"from": requester})

    # Initial balances
    first_claimer_eth_balance = web3.eth.get_balance(first_claimer.address)
    second_claimer_eth_balance = web3.eth.get_balance(second_claimer.address)
    owner_eth_balance = web3.eth.get_balance(request_manager.owner())

    request_id = make_request(request_manager, token, requester, requester, transfer_amount)

    # Creating 4 Claims
    fill_id = FILL_ID

    # Claim 1: valid claim
    claim_tx_1 = request_manager.claimRequest(
        request_id, fill_id, {"from": first_claimer, "value": claim_stake}
    )
    claim_id_1 = claim_tx_1.return_value

    # Claim 2: claimer is not the filler, invalid claim
    claim_tx_2 = request_manager.claimRequest(
        request_id, fill_id, {"from": second_claimer, "value": claim_stake}
    )
    claim_id_2 = claim_tx_2.return_value

    # Claim 3: another valid claim
    claim_tx_3 = request_manager.claimRequest(
        request_id, fill_id, {"from": first_claimer, "value": claim_stake}
    )
    claim_id_3 = claim_tx_3.return_value

    # Claim 4: claimer is the filler but fill id is wrong, invalid claim
    claim_tx_4 = request_manager.claimRequest(
        request_id, b"wrong fill id", {"from": first_claimer, "value": claim_stake}
    )
    claim_id_4 = claim_tx_4.return_value

    contracts.l1_messenger.setLastSender(contracts.resolver.address)

    # Before L1 resolution, all claims are still running and cannot be withdrawn
    with brownie.reverts("Claim period not finished"):
        request_manager.withdraw(claim_id_1, {"from": first_claimer})
    with brownie.reverts("Claim period not finished"):
        request_manager.withdraw(claim_id_2, {"from": second_claimer})
    with brownie.reverts("Claim period not finished"):
        request_manager.withdraw(claim_id_3, {"from": first_claimer})
    with brownie.reverts("Claim period not finished"):
        request_manager.withdraw(claim_id_4, {"from": first_claimer})

    # Start L1 resolution
    request_hash = create_request_hash(
        request_id,
        web3.eth.chain_id,
        web3.eth.chain_id,
        token.address,
        requester.address,
        transfer_amount,
    )

    # Register a L1 resolution
    resolution_registry.resolveRequest(
        request_hash, fill_id, web3.eth.chain_id, first_claimer, {"from": contracts.l1_messenger}
    )

    # The claim period is not over, but the resolution must allow withdrawal now
    # Valid claim will result in payout
    withdraw_tx = request_manager.withdraw(claim_id_1, {"from": first_claimer})
    assert "DepositWithdrawn" in withdraw_tx.events
    assert "ClaimWithdrawn" in withdraw_tx.events

    # Wrong claimer, since it is not challenged stakes go to the contract owner
    withdraw_tx = request_manager.withdraw(claim_id_2, {"from": second_claimer})
    assert "DepositWithdrawn" not in withdraw_tx.events
    assert "ClaimWithdrawn" in withdraw_tx.events

    # Another valid claim, deposit is already withdrawn but stakes go back to claimer
    withdraw_tx = request_manager.withdraw(claim_id_3, {"from": first_claimer})
    assert "DepositWithdrawn" not in withdraw_tx.events
    assert "ClaimWithdrawn" in withdraw_tx.events

    # Wrong fill id, since it is not challenged stakes go to the contract owner
    withdraw_tx = request_manager.withdraw(claim_id_4, {"from": first_claimer})
    assert "DepositWithdrawn" not in withdraw_tx.events
    assert "ClaimWithdrawn" in withdraw_tx.events

    assert web3.eth.get_balance(first_claimer.address) == first_claimer_eth_balance - claim_stake
    assert web3.eth.get_balance(second_claimer.address) == second_claimer_eth_balance - claim_stake
    # Two of the claims were invalid, thus stakes went to the contract owner
    assert web3.eth.get_balance(request_manager.owner()) == owner_eth_balance + 2 * claim_stake


def test_withdraw_two_challengers(
    request_manager, token, claim_stake, finalization_time, challenge_period_extension
):
    claimer, first_challenger, second_challenger, requester = alloc_accounts(4)

    request_id = make_request(request_manager, token, requester, requester, 1)
    claim = request_manager.claimRequest(
        request_id, FILL_ID, {"from": claimer, "value": claim_stake}
    )
    claim_id = claim.return_value
    first_challenger_eth_balance = web3.eth.get_balance(first_challenger.address)
    second_challenger_eth_balance = web3.eth.get_balance(second_challenger.address)

    # First challenger challenges
    request_manager.challengeClaim(claim_id, {"from": first_challenger, "value": claim_stake + 1})
    # Claimer outbids again
    request_manager.challengeClaim(claim_id, {"from": claimer, "value": claim_stake + 10})
    # Second challenger challenges
    request_manager.challengeClaim(
        claim_id, {"from": second_challenger, "value": claim_stake + 11}
    )

    first_challenger_reward = claim_stake + 1
    second_challenger_reward = claim_stake + 9

    # Withdraw must fail when claim period is not over
    with brownie.reverts("Claim period not finished"):
        request_manager.withdraw(claim_id, {"from": first_challenger})
    # Withdraw must fail when claim period is not over
    with brownie.reverts("Claim period not finished"):
        request_manager.withdraw(claim_id, {"from": second_challenger})
    # Withdraw must fail when claim period is not over
    with brownie.reverts("Claim period not finished"):
        request_manager.withdraw(claim_id, {"from": claimer})

    # Timetravel after claim period
    chain.mine(timedelta=finalization_time + challenge_period_extension)

    # Take snapshot
    chain.snapshot()

    def _withdraw_by_order(first_withdrawer, second_withdrawer):
        request_manager.withdraw(claim_id, {"from": first_withdrawer})

        # Challenger cannot withdraw twice
        with brownie.reverts("Challenger has nothing to withdraw"):
            request_manager.withdraw(claim_id, {"from": first_withdrawer})
        with brownie.reverts("Challenger has nothing to withdraw"):
            request_manager.withdraw(claim_id, {"from": claimer})

        request_manager.withdraw(claim_id, {"from": second_withdrawer})

        assert (
            web3.eth.get_balance(first_challenger.address)
            == first_challenger_eth_balance + first_challenger_reward
        )
        assert (
            web3.eth.get_balance(second_challenger.address)
            == second_challenger_eth_balance + second_challenger_reward
        )

    _withdraw_by_order(first_challenger, second_challenger)
    # revert to snapshot
    chain.revert()
    _withdraw_by_order(second_challenger, first_challenger)

    # All stakes are withdrawn already
    with brownie.reverts("Claim already withdrawn"):
        request_manager.withdraw(claim_id, {"from": claimer})


def test_withdraw_expired(token, request_manager):
    """Test that a request can be withdrawn once it is expired"""
    validity_period = 60 * 5
    (requester,) = alloc_accounts(1)

    amount = 17
    token.mint(requester, amount)

    request_id = make_request(
        request_manager, token, requester, requester, amount, validity_period=validity_period
    )

    assert token.balanceOf(requester) == 0

    chain.mine(timedelta=validity_period)
    tx = request_manager.withdrawExpiredRequest(request_id, {"from": requester})
    assert "DepositWithdrawn" in tx.events
    assert token.balanceOf(requester) == amount


def test_withdraw_before_expiration(token, request_manager):
    """Test that a request cannot be withdrawn before it is expired"""
    validity_period = 60 * 5
    (requester,) = alloc_accounts(1)

    request_id = make_request(
        request_manager, token, requester, requester, 1, validity_period=validity_period
    )

    chain.mine(timedelta=validity_period / 2)
    with brownie.reverts("Request not expired yet"):
        request_manager.withdrawExpiredRequest(request_id, {"from": requester})


def test_deprecation(deployer, request_manager, token):
    (requester,) = alloc_accounts(1)
    amount = 17
    token.mint(requester, 2 * amount)

    make_request(
        request_manager,
        token,
        requester,
        requester,
        amount,
    )
    with brownie.reverts("Ownable: caller is not the owner"):
        request_manager.deprecateContract({"from": requester.address})

    assert not request_manager.deprecated()
    request_manager.deprecateContract({"from": deployer.address})
    assert request_manager.deprecated()

    with brownie.reverts("Contract already deprecated"):
        request_manager.deprecateContract({"from": deployer.address})

    with brownie.reverts("Contract is deprecated"):
        make_request(
            request_manager,
            token,
            requester,
            requester,
            amount,
        )


def test_transfer_limit_update_only_owner(deployer, request_manager):
    (random_guy,) = alloc_accounts(1)
    original_transfer_limit = request_manager.transferLimit.call()
    new_transfer_limit = original_transfer_limit + 1

    with brownie.reverts("Ownable: caller is not the owner"):
        request_manager.updateTransferLimit(new_transfer_limit, {"from": random_guy.address})

    assert request_manager.transferLimit.call() == original_transfer_limit
    request_manager.updateTransferLimit(new_transfer_limit, {"from": deployer.address})
    assert request_manager.transferLimit.call() == new_transfer_limit
    # Also show that transfer limit can be decreased again
    request_manager.updateTransferLimit(original_transfer_limit, {"from": deployer.address})
    assert request_manager.transferLimit.call() == original_transfer_limit


def test_transfer_limit_requests(deployer, request_manager, token):
    (requester,) = alloc_accounts(1)
    transfer_limit = request_manager.transferLimit.call()

    assert token.balanceOf(requester) == 0
    token.mint(requester, transfer_limit)

    make_request(request_manager, token, requester, requester, transfer_limit)

    assert token.balanceOf(requester) == 0
    token.mint(requester, transfer_limit + 1)

    with brownie.reverts("Amount exceeds transfer limit"):
        make_request(request_manager, token, requester, requester, transfer_limit + 1)

    request_manager.updateTransferLimit(transfer_limit + 1, {"from": deployer.address})

    make_request(request_manager, token, requester, requester, transfer_limit + 1)

    assert token.balanceOf(requester) == 0
