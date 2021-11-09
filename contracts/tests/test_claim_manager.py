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
    """Test challanging a claim"""
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
