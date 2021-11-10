import brownie
from brownie import accounts, chain


def test_claim_with_different_stakes(claim_manager, claim_stake):
    """Test that only claims with the correct stake can be submitted"""
    claim = claim_manager.claimRequest(123, {"from": accounts[0], "value": claim_stake})
    assert "ClaimCreated" in claim.events

    with brownie.reverts("Stake provided not correct"):
        claim_manager.claimRequest(123, {"from": accounts[0], "value": claim_stake - 1})

    with brownie.reverts("Stake provided not correct"):
        claim_manager.claimRequest(123, {"from": accounts[0], "value": claim_stake + 1})

    with brownie.reverts("Stake provided not correct"):
        claim_manager.claimRequest(123, {"from": accounts[0]})


def test_claim_successful(claim_manager, claim_stake, claim_period):
    """Test that a claim completes after the claim period"""
    claim = claim_manager.claimRequest(123, {"from": accounts[0], "value": claim_stake})

    assert not claim_manager.claimSuccessful(claim.return_value)

    # Timetravel after claim period
    chain.mine(timedelta=claim_period)

    assert claim_manager.claimSuccessful(claim.return_value)

    # Challenge shouldn't work any more
    with brownie.reverts("Already claimed successfully"):
        claim_manager.challengeClaim(claim.return_value)


def test_claim_challenge(claim_manager, claim_stake):
    """Test challenging a claim"""
    claim = claim_manager.claimRequest(123, {"from": accounts[0], "value": claim_stake})

    with brownie.reverts("Not enough funds provided"):
        claim_manager.challengeClaim(
            claim.return_value, {"from": accounts[1], "value": claim_stake}
        )

    with brownie.reverts("Not enough funds provided"):
        claim_manager.challengeClaim(claim.return_value, {"from": accounts[1]})

    # Do a proper challenge
    challenge = claim_manager.challengeClaim(
        claim.return_value, {"from": accounts[1], "value": claim_stake + 1}
    )
    assert "ClaimChallenged" in challenge.events

    with brownie.reverts("Already challenged"):
        claim_manager.challengeClaim(
            claim.return_value, {"from": accounts[1], "value": claim_stake + 1}
        )


def test_claim_counter_challenge(claim_manager, claim_stake):
    """Test counter-challenging a challenge"""
    claimer = accounts[0]
    challenger = accounts[1]

    claim = claim_manager.claimRequest(123, {"from": claimer, "value": claim_stake})
    claim_id = claim.return_value

    with brownie.reverts("Claim not yet challenged"):
        claim_manager.counterChallenge(claim_id, {"from": accounts[2], "value": claim_stake})

    # Do a proper challenge
    claim_manager.challengeClaim(claim_id, {"from": challenger, "value": claim_stake + 1})

    # Another party must not be able to join the challenge game
    with brownie.reverts("Already challenged by another address"):
        claim_manager.counterChallenge(claim_id, {"from": accounts[2]})

    # The sender of the last challenge must not be able to challenge again
    with brownie.reverts("Not eligible to outbid"):
        claim_manager.counterChallenge(claim_id, {"from": challenger})

    # The other party must be able to re-challenge
    outbid = claim_manager.counterChallenge(claim_id, {"from": claimer, "value": 2})
    assert "ChallengeCountered" in outbid.events

    # Check that the roles are reversed now
    with brownie.reverts("Not eligible to outbid"):
        claim_manager.counterChallenge(claim_id, {"from": claimer, "value": 1})

    # The other party must be able to re-challenge, but must increase the stake
    with brownie.reverts("Not enough funds provided"):
        claim_manager.counterChallenge(claim_id, {"from": challenger, "value": 1})
    claim_manager.counterChallenge(claim_id, {"from": challenger, "value": 2})


def test_claim_period_extension(
    claim_manager, claim_stake, claim_period, challenge_period, challenge_period_extension
):
    claimer = accounts[0]
    challenger = accounts[1]

    claim = claim_manager.claimRequest(123, {"from": claimer, "value": claim_stake})
    claim_id = claim.return_value

    assert claim.timestamp + claim_period == claim_manager.claims(claim_id)[2]

    challenge = claim_manager.challengeClaim(
        claim_id, {"from": challenger, "value": claim_stake + 1}
    )
    assert challenge.timestamp + challenge_period == claim_manager.challenges(claim_id)[3]

    # Another challenge with big margin to the end of the termination
    # shouldn't increase the termination
    claim_manager.counterChallenge(claim_id, {"from": claimer, "value": 2})
    assert challenge.timestamp + challenge_period == claim_manager.challenges(claim_id)[3]

    # Timetravel close to end of challenge period
    chain.mine(timedelta=challenge_period * 8 / 10)
    rechallenge = claim_manager.counterChallenge(claim_id, {"from": challenger, "value": 2})
    assert (
        rechallenge.timestamp + challenge_period_extension == claim_manager.challenges(claim_id)[3]
    )

    # Timetravel over the end of challenge period
    chain.mine(timedelta=challenge_period_extension)
    with brownie.reverts("Challenge period finished"):
        claim_manager.counterChallenge(claim_id, {"from": claimer, "value": 2})
