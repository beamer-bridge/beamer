import brownie
from eth_abi.packed import encode_abi_packed
from eth_utils import keccak

from beamer.tests.util import alloc_accounts, create_request_hash


def test_fill_request(fill_manager, token, deployer):
    chain_id = brownie.web3.eth.chain_id
    amount = 100
    filler, receiver = alloc_accounts(2)

    with brownie.reverts("Ownable: caller is not the owner"):
        fill_manager.addAllowedLP(deployer, {"from": filler})

    whitelist_tx = fill_manager.addAllowedLP(deployer, {"from": deployer})
    assert "LPAdded" in whitelist_tx.events

    token.approve(fill_manager.address, amount, {"from": deployer})
    fill_manager.fillRequest(
        1,
        chain_id,
        token.address,
        receiver,
        amount,
        {"from": deployer},
    )

    with brownie.reverts("Already filled"):
        fill_manager.fillRequest(
            1,
            chain_id,
            token.address,
            receiver,
            amount,
            {"from": deployer},
        )

    fill_manager.removeAllowedLP(deployer, {"from": deployer})
    with brownie.reverts("Sender not whitelisted"):
        fill_manager.fillRequest(
            1,
            chain_id,
            token.address,
            receiver,
            amount,
            {"from": deployer},
        )

    blacklist_tx = fill_manager.removeAllowedLP(deployer, {"from": deployer})
    assert "LPRemoved" in blacklist_tx.events


def test_invalidate_valid_fill_hash(fill_manager, token, deployer):
    chain_id = brownie.web3.eth.chain_id
    amount = 100
    (receiver,) = alloc_accounts(1)

    fill_manager.addAllowedLP(deployer, {"from": deployer})

    token.approve(fill_manager.address, amount, {"from": deployer})
    request_id = 1
    tx = fill_manager.fillRequest(
        request_id,
        chain_id,
        token.address,
        receiver,
        amount,
        {"from": deployer},
    )
    fill_id = tx.return_value
    request_hash = create_request_hash(
        request_id,
        chain_id,
        chain_id,
        token.address,
        receiver.address,
        amount,
    )
    with brownie.reverts("Fill hash valid"):
        fill_manager.invalidateFillHash(request_hash, fill_id, chain_id)


def test_invalidated_fill_hash_event(fill_manager):
    request_hash = "1234" + "00" * 30
    fill_id = "5678" + "00" * 30
    chain_id = brownie.web3.eth.chain_id

    tx = fill_manager.invalidateFillHash(request_hash, fill_id, chain_id)

    fill_hash = keccak(
        encode_abi_packed(
            ["bytes32", "bytes32"],
            [
                bytes.fromhex(request_hash),
                bytes.fromhex(fill_id),
            ],
        )
    )

    assert "HashInvalidated" in tx.events
    assert tx.events["HashInvalidated"]["requestHash"] == "0x" + request_hash
    assert tx.events["HashInvalidated"]["fillId"] == "0x" + fill_id
    assert tx.events["HashInvalidated"]["fillHash"] == "0x" + fill_hash.hex()
