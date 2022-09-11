import brownie
from eth_abi.packed import encode_abi_packed
from eth_utils import keccak

from beamer.tests.util import alloc_accounts, alloc_whitelisted_accounts, create_request_id


def test_fill_request(fill_manager, token):
    chain_id = brownie.web3.eth.chain_id
    amount = 100
    (receiver,) = alloc_accounts(1)
    (filler,) = alloc_whitelisted_accounts(1, {fill_manager})

    with brownie.reverts("Ownable: caller is not the owner"):
        fill_manager.addAllowedLp(filler, {"from": receiver})

    whitelist_tx = fill_manager.addAllowedLp(receiver)
    assert "LpAdded" in whitelist_tx.events
    blacklist_tx = fill_manager.removeAllowedLp(receiver)
    assert "LpRemoved" in blacklist_tx.events

    token.mint(filler, amount)
    token.approve(fill_manager.address, amount, {"from": filler})
    fill_manager.fillRequest(
        chain_id,
        token.address,
        receiver,
        amount,
        1,
        {"from": filler},
    )

    with brownie.reverts("Already filled"):
        fill_manager.fillRequest(
            chain_id,
            token.address,
            receiver,
            amount,
            1,
            {"from": filler},
        )

    blacklist_tx = fill_manager.removeAllowedLp(filler)
    assert "LpRemoved" in blacklist_tx.events

    with brownie.reverts("Sender not whitelisted"):
        fill_manager.fillRequest(
            chain_id,
            token.address,
            receiver,
            amount,
            1,
            {"from": filler},
        )


def test_invalidate_valid_fill_hash(fill_manager, token):
    chain_id = brownie.web3.eth.chain_id
    amount = 100
    nonce = 1
    (receiver,) = alloc_accounts(1)
    (filler,) = alloc_whitelisted_accounts(1, {fill_manager})
    token.mint(filler, amount)
    token.approve(fill_manager.address, amount, {"from": filler})

    tx = fill_manager.fillRequest(
        chain_id,
        token.address,
        receiver,
        amount,
        nonce,
        {"from": filler},
    )
    fill_id = tx.return_value
    request_id = create_request_id(
        chain_id, chain_id, token.address, receiver.address, amount, nonce
    )
    with brownie.reverts("Fill hash valid"):
        fill_manager.invalidateFill(request_id, fill_id, chain_id)


def test_invalidated_fill_hash_event(fill_manager):
    request_id = "1234" + "00" * 30
    fill_id = "5678" + "00" * 30
    chain_id = brownie.web3.eth.chain_id

    tx = fill_manager.invalidateFill(request_id, fill_id, chain_id)

    fill_hash = keccak(
        encode_abi_packed(
            ["bytes32", "bytes32"],
            [
                bytes.fromhex(request_id),
                bytes.fromhex(fill_id),
            ],
        )
    )

    assert "HashInvalidated" in tx.events
    assert tx.events["HashInvalidated"]["requestId"] == "0x" + request_id
    assert tx.events["HashInvalidated"]["fillId"] == "0x" + fill_id
    assert tx.events["HashInvalidated"]["fillHash"] == "0x" + fill_hash.hex()
