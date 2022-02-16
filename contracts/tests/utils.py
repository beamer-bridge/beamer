from eth_abi.packed import encode_abi_packed
from eth_utils import keccak, to_canonical_address


def make_request(
    request_manager, token, requester, amount, zero_fees=True, validity_period=3600
) -> int:
    if token.balanceOf(requester) < amount:
        token.mint(requester, amount, {"from": requester})

    if zero_fees:
        request_manager.updateFeeData(0, 0)

    token.approve(request_manager.address, amount, {"from": requester})

    total_fee = request_manager.totalFee()
    request_tx = request_manager.createRequest(
        1,
        token.address,
        token.address,
        requester,
        amount,
        validity_period,
        {"from": requester, "value": total_fee},
    )
    return request_tx.return_value


def create_request_hash(request_id, chain_id, token_address, receiver_address, amount):
    return keccak(
        encode_abi_packed(
            ["uint256", "uint256", "address", "address", "uint256"],
            [
                request_id,
                chain_id,
                to_canonical_address(token_address),
                to_canonical_address(receiver_address),
                amount,
            ],
        )
    )


def create_fill_hash(request_id, chain_id, token_address, receiver_address, amount, fill_id):
    return keccak(
        encode_abi_packed(
            ["bytes32", "uint256"],
            [
                create_request_hash(request_id, chain_id, token_address, receiver_address, amount),
                fill_id,
            ],
        )
    )
