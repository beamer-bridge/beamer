from brownie import accounts

from contracts.tests.utils import make_request


def test_only_sender_can_cancel_request(request_manager, token):
    requester = accounts[1]
    transfer_amount = 23

    request_id = make_request(request_manager, token, requester, transfer_amount)

    reimbursement_fee = request_manager.gasReimbursementFee()
    lp_service_fee = request_manager.lpServiceFee()
    raisync_fee = request_manager.raisyncServiceFee()

    assert request_manager.collectedRaisyncFees() == raisync_fee
    assert request_manager.requests(request_id)[9] == reimbursement_fee + lp_service_fee
