from brownie import accounts


def test_only_sender_can_cancel_request(request_manager, token):
    requester = accounts[1]
    transfer_amount = 23

    f1 = request_manager.gasReimbursementFee()
    f2 = request_manager.lpServiceFee()
    f3 = request_manager.raisyncServiceFee()

    token.mint(requester, transfer_amount, {"from": requester})
    token.approve(request_manager.address, transfer_amount, {"from": requester})
    request_tx = request_manager.createRequest(
        1,
        token.address,
        token.address,
        "0x5d5640575161450A674a094730365A223B226649",
        transfer_amount,
        {"from": requester, "value": f1 + f2 + f3},
    )
    request_id = request_tx.return_value

    assert request_manager.collectedRaisyncFees() == 62856900000000
    assert request_manager.requests(request_id)[9] == 1459676900000000
