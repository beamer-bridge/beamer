import brownie
from brownie import chain, web3

from beamer.tests.util import alloc_accounts, make_request

RM_FIELD_LP_FEE = 9
RM_FIELD_BEAMER_FEE = 10


def test_fee_split_works(request_manager, token, claim_stake, claim_period):
    requester, claimer = alloc_accounts(2)
    transfer_amount = 23

    request_id = make_request(
        request_manager, token, requester, requester, transfer_amount, zero_fees=False
    )

    reimbursement_fee = request_manager.gasReimbursementFee()
    lp_service_fee = request_manager.lpServiceFee()
    beamer_fee = request_manager.beamerServiceFee()
    assert beamer_fee > 0

    # The request is not claimed yet, so no beamer fee has been collected yet
    assert request_manager.collectedBeamerFees() == 0
    assert (
        request_manager.requests(request_id)[RM_FIELD_LP_FEE] == reimbursement_fee + lp_service_fee
    )
    assert request_manager.requests(request_id)[RM_FIELD_BEAMER_FEE] == beamer_fee

    claim_tx = request_manager.claimRequest(request_id, 0, {"from": claimer, "value": claim_stake})
    claim_id = claim_tx.return_value

    # Timetravel after claim period
    chain.mine(timedelta=claim_period)

    # Even if the requester calls withdraw, the funds go to the claimer
    withdraw_tx = request_manager.withdraw(claim_id, {"from": requester})
    assert "ClaimWithdrawn" in withdraw_tx.events

    assert request_manager.collectedBeamerFees() == beamer_fee
    assert request_manager.requests(request_id)[9] == reimbursement_fee + lp_service_fee
    assert request_manager.requests(request_id)[10] == beamer_fee


def test_beamer_service_fee_withdrawable_by_owner(
    deployer, request_manager, token, claim_stake, claim_period
):
    owner = deployer
    requester, claimer = alloc_accounts(2)
    beamer_fee = request_manager.beamerServiceFee()
    request_id = make_request(request_manager, token, requester, requester, 23, zero_fees=False)

    with brownie.reverts("Ownable: caller is not the owner"):
        request_manager.withdrawbeamerFees({"from": requester})

    assert request_manager.collectedBeamerFees() == 0
    with brownie.reverts("Zero fees available"):
        request_manager.withdrawbeamerFees({"from": owner})

    claim_tx = request_manager.claimRequest(request_id, 0, {"from": claimer, "value": claim_stake})
    claim_id = claim_tx.return_value

    chain.mine(timedelta=claim_period)

    assert request_manager.collectedBeamerFees() == 0
    with brownie.reverts("Zero fees available"):
        request_manager.withdrawbeamerFees({"from": owner})

    request_manager.withdraw(claim_id, {"from": requester})

    owner_eth = web3.eth.get_balance(owner.address)

    request_manager.withdrawbeamerFees({"from": owner})
    assert web3.eth.get_balance(owner.address) == owner_eth + beamer_fee


def test_fee_gas_price_updatable_by_owner(deployer, request_manager, token):
    (requester,) = alloc_accounts(1)
    make_request(request_manager, token, requester, requester, 23, zero_fees=False)

    old_gas_price = request_manager.gasPrice()
    old_fee = request_manager.totalFee()

    new_gas_price = old_gas_price * 2

    with brownie.reverts("Ownable: caller is not the owner"):
        request_manager.updateFeeData(new_gas_price, 45_000, {"from": requester})

    request_manager.updateFeeData(new_gas_price, 45_000, {"from": deployer})
    assert request_manager.gasPrice() == new_gas_price
    assert request_manager.totalFee() == 2 * old_fee


def test_fee_reimbursed_on_expiration(request_manager, token):
    (requester,) = alloc_accounts(1)
    transfer_amount = 23
    validity_period = 60 * 5

    requester_eth = web3.eth.get_balance(requester.address)

    request_id = make_request(
        request_manager,
        token,
        requester,
        requester,
        transfer_amount,
        zero_fees=False,
        validity_period=validity_period,
    )

    total_fee = request_manager.totalFee()
    assert total_fee > 0
    assert web3.eth.get_balance(requester.address) == requester_eth - total_fee
    assert request_manager.collectedBeamerFees() == 0

    # Timetravel after validity period
    chain.mine(timedelta=validity_period)

    request_manager.withdrawExpiredRequest(request_id, {"from": requester})
    assert request_manager.collectedBeamerFees() == 0
    assert web3.eth.get_balance(requester.address) == requester_eth

    assert token.balanceOf(requester) == transfer_amount
