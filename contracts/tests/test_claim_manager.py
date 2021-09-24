from brownie import accounts
import brownie

def test_claim_with_different_values(claim_manager, claim_stake):

    claim_manager.claimRequest(123, {"from": accounts[0], "value": claim_stake})

    with brownie.reverts("Stake provided not correct"):
        claim_manager.claimRequest(123, {"from": accounts[0], "value": claim_stake-1})

    with brownie.reverts("Stake provided not correct"):
        claim_manager.claimRequest(123, {"from": accounts[0], "value": claim_stake+1})
