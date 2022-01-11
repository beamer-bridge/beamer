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
