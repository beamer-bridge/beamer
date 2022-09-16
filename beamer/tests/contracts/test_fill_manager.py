import brownie

from brownie import FillManager, TestL2Messenger

from beamer.tests.agent.utils import make_address
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


def test_invalidate_valid_fill(fill_manager, token):
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
    with brownie.reverts("Fill valid"):
        fill_manager.invalidateFill(request_id, fill_id, chain_id)


def test_fill_invalidated_event(fill_manager):
    request_id = "1234" + "00" * 30
    fill_id = "5678" + "00" * 30
    chain_id = brownie.web3.eth.chain_id

    tx = fill_manager.invalidateFill(request_id, fill_id, chain_id)

    assert "FillInvalidated" in tx.events
    assert tx.events["FillInvalidated"]["requestId"] == "0x" + request_id
    assert tx.events["FillInvalidated"]["fillId"] == "0x" + fill_id


def test_unset_resolver(deployer, token):
    chain_id = brownie.web3.eth.chain_id

    # deploy new contracts
    l2_messenger = deployer.deploy(TestL2Messenger)
    new_fill_manager = deployer.deploy(FillManager, l2_messenger)
    l2_messenger.addCaller(chain_id, new_fill_manager.address)

    amount = 100
    (receiver,) = alloc_accounts(1)
    (filler,) = alloc_whitelisted_accounts(1, {new_fill_manager})

    token.mint(filler, amount)
    token.approve(new_fill_manager.address, amount, {"from": filler})
    with brownie.reverts("Resolver address not set"):
        new_fill_manager.fillRequest(
            chain_id,
            token.address,
            receiver,
            amount,
            1,
            {"from": filler},
        )

    request_id = create_request_id(chain_id, chain_id, token.address, receiver.address, amount, 1)

    with brownie.reverts("Resolver address not set"):
        new_fill_manager.invalidateFill(request_id, 1, chain_id)

    with brownie.reverts("Ownable: caller is not the owner"):
        new_fill_manager.setResolver(make_address(), {"from": filler})

    new_fill_manager.setResolver(make_address())

    with brownie.reverts("Resolver already set"):
        new_fill_manager.setResolver(make_address())

    new_fill_manager.fillRequest(
        chain_id,
        token.address,
        receiver,
        amount,
        1,
        {"from": filler},
    )

    new_fill_manager.invalidateFill(request_id, 1, chain_id)
