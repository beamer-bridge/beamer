import ape
from hexbytes import HexBytes

from beamer.tests.util import alloc_accounts, alloc_whitelisted_accounts, make_address
from beamer.typing import ChainId, TokenAmount
from beamer.util import create_request_id


def test_fill_request(fill_manager, token):
    chain_id = ape.chain.chain_id
    amount = 100
    (receiver,) = alloc_accounts(1)
    (filler,) = alloc_whitelisted_accounts(1, [fill_manager])

    with ape.reverts("Ownable: caller is not the owner"):
        fill_manager.addAllowedLp(filler, sender=receiver)

    whitelist_tx = fill_manager.addAllowedLp(receiver)
    assert whitelist_tx.events.filter(fill_manager.LpAdded)
    blacklist_tx = fill_manager.removeAllowedLp(receiver)
    assert blacklist_tx.events.filter(fill_manager.LpRemoved)

    token.mint(filler, amount)
    with ape.accounts.test_accounts.use_sender(filler):
        token.approve(fill_manager.address, amount)
        fill_manager.fillRequest(
            chain_id,
            token.address,
            receiver,
            amount,
            1,
        )

        with ape.reverts("Already filled"):
            fill_manager.fillRequest(
                chain_id,
                token.address,
                receiver,
                amount,
                1,
            )

    blacklist_tx = fill_manager.removeAllowedLp(filler)
    assert blacklist_tx.events.filter(fill_manager.LpRemoved)

    with ape.reverts("Not allowed"):
        fill_manager.fillRequest(
            chain_id,
            token.address,
            receiver,
            amount,
            1,
            sender=filler,
        )


def test_invalidate_valid_fill(fill_manager, token):
    chain_id = ape.chain.chain_id
    amount = 100
    nonce = 1
    (receiver,) = alloc_accounts(1)
    (filler,) = alloc_whitelisted_accounts(1, [fill_manager])
    token.mint(filler, amount)

    with ape.accounts.test_accounts.use_sender(filler):
        token.approve(fill_manager.address, amount)

        tx = fill_manager.fillRequest(
            chain_id,
            token.address,
            receiver,
            amount,
            nonce,
        )
    fill_id = tx.return_value

    with ape.reverts("Fill valid"):
        fill_manager.invalidateFill(
            chain_id, token.address, receiver.address, amount, nonce, fill_id
        )


def test_fill_invalidated_event(fill_manager):
    chain_id = ChainId(ape.chain.chain_id)
    token_address = make_address()
    receiver_address = make_address()
    amount = TokenAmount(1)
    nonce = 1

    request_id = create_request_id(
        chain_id, chain_id, token_address, receiver_address, amount, nonce
    )
    fill_id = "5678" + "00" * 30

    tx = fill_manager.invalidateFill(
        chain_id, token_address, receiver_address, amount, nonce, HexBytes(fill_id)
    )

    assert tx.events.filter(
        fill_manager.FillInvalidated,
        requestId=request_id,
        fillId=HexBytes("0x" + fill_id),
    )


def test_unset_resolver(deployer, token):
    chain_id = ape.chain.chain_id

    # deploy new contracts
    l2_messenger = deployer.deploy(ape.project.TestL2Messenger)
    new_fill_manager = deployer.deploy(ape.project.FillManager, l2_messenger)
    l2_messenger.addCaller(new_fill_manager.address)

    amount = 100
    (receiver,) = alloc_accounts(1)
    (filler,) = alloc_whitelisted_accounts(1, [new_fill_manager])

    token.mint(filler, amount)
    with ape.accounts.test_accounts.use_sender(filler):
        token.approve(new_fill_manager.address, amount)
        with ape.reverts("Resolver address not set"):
            new_fill_manager.fillRequest(
                chain_id,
                token.address,
                receiver,
                amount,
                1,
            )

    with ape.reverts("Resolver address not set"):
        new_fill_manager.invalidateFill(chain_id, token.address, receiver.address, amount, 1, b"1")

    with ape.reverts("Ownable: caller is not the owner"):
        new_fill_manager.setResolver(make_address(), sender=filler)

    new_fill_manager.setResolver(make_address())

    with ape.reverts("Resolver already set"):
        new_fill_manager.setResolver(make_address())

    new_fill_manager.fillRequest(
        chain_id,
        token.address,
        receiver,
        amount,
        1,
        sender=filler,
    )

    new_fill_manager.invalidateFill(chain_id, token.address, receiver.address, amount, 1, b"1")


def test_invalidate_previous_block_hash(fill_manager):
    chain_id = ape.chain.chain_id
    token_address = make_address()
    receiver_address = make_address()
    amount = nonce = 1

    current_block = ape.chain.blocks[-1]
    with ape.reverts("Cannot invalidate fills of current block"):
        fill_manager.invalidateFill(
            chain_id, token_address, receiver_address, amount, nonce, current_block.hash
        )

    assert current_block.hash != ape.chain.blocks[-1].hash

    # We proceeded one block so invalidating the fill id should work now
    fill_manager.invalidateFill(
        chain_id, token_address, receiver_address, amount, nonce, current_block.hash
    )
