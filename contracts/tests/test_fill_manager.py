from brownie import accounts
import brownie


def test_fill_request(fill_manager, token):
    transfer_amount = 100

    token.approve(fill_manager.address, transfer_amount, {"from": accounts[0]})
    fill_manager.fillRequest(
        1,
        1,
        token.address,
        "0x5d5640575161450A674a094730365A223B226649",
        transfer_amount,
        {"from": accounts[0]},
    )

    with brownie.reverts("Already filled"):
        fill_manager.fillRequest(
            1,
            1,
            token.address,
            "0x5d5640575161450A674a094730365A223B226649",
            transfer_amount,
            {"from": accounts[0]},
        )
