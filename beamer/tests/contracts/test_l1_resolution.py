import ape
import pytest
from hexbytes import HexBytes
from web3.constants import ADDRESS_ZERO

from beamer.tests.constants import FILL_ID, FILL_ID_EMPTY
from beamer.tests.util import (
    alloc_accounts,
    alloc_whitelisted_accounts,
    create_request_id,
    make_address,
)
from beamer.typing import RequestId


@pytest.mark.parametrize("amount", [100, 99, 101])
@pytest.mark.parametrize("forward_state", [True])
def test_l1_resolution_correct_id(request_manager, fill_manager, token, amount):
    requested_amount = 100
    nonce = 23
    (receiver,) = alloc_accounts(1)
    (filler,) = alloc_whitelisted_accounts(1, [fill_manager])
    chain_id = ape.chain.chain_id

    with ape.accounts.test_accounts.use_sender(filler):
        token.mint(filler, amount)
        token.approve(fill_manager.address, amount)

        fill_tx = fill_manager.fillRequest(chain_id, token.address, receiver, amount, nonce)
    fill_id = fill_tx.return_value

    request_id = create_request_id(
        chain_id,
        chain_id,
        token.address,
        receiver.address,
        requested_amount,
        nonce,
    )

    expected_address = ADDRESS_ZERO
    expected_fill_id = FILL_ID_EMPTY

    if amount == requested_amount:
        expected_address = filler
        expected_fill_id = fill_id

    request = request_manager.requests(request_id)

    assert request.filler == expected_address
    assert request.fillId == ape.convert(expected_fill_id, bytes)


@pytest.mark.parametrize("forward_state", [True])
def test_l1_non_fill_proof(fill_manager, request_manager):
    chain_id = ape.chain.chain_id
    token_address = make_address()
    receiver_address = make_address()
    amount = nonce = 1
    fill_id = HexBytes("5678" + "00" * 30)

    request_id = create_request_id(
        chain_id, chain_id, token_address, receiver_address, amount, nonce
    )
    fill_manager.invalidateFill(chain_id, token_address, receiver_address, amount, nonce, fill_id)
    assert request_manager.isInvalidFill(request_id, fill_id)


def test_invalidation_before_and_after_resolution(contracts, request_manager):
    contracts.l1_messenger.setLastSender(contracts.resolver.address)

    address = make_address()
    request_id = RequestId(31 * b"0" + b"1")
    chain_id = ape.chain.chain_id

    assert not request_manager.isInvalidFill(request_id, FILL_ID)
    request_manager.invalidateFill(request_id, FILL_ID, chain_id, sender=contracts.l1_messenger)

    # Fill must be invalidated
    assert request_manager.isInvalidFill(request_id, FILL_ID)

    assert request_manager.requests(request_id).filler == ADDRESS_ZERO

    request_manager.resolveRequest(
        request_id, FILL_ID, chain_id, address, sender=contracts.l1_messenger
    )

    # Resolution validates fill again
    assert not request_manager.isInvalidFill(request_id, FILL_ID)
    assert request_manager.requests(request_id).filler == address

    # Invalidation of a resolved request should fail
    with ape.reverts("Cannot invalidate resolved fills"):
        request_manager.invalidateFill(
            request_id, FILL_ID, chain_id, sender=contracts.l1_messenger
        )


def test_restricted_calls(contracts, resolver, request_manager):
    """Test that important contract calls cannot be invoked by a random caller."""
    (caller,) = alloc_accounts(1)

    # fill_manager -> messenger1 -> L1 resolver ->
    # messenger2 -> request manager

    with ape.reverts("RestrictedCalls: call disallowed"):
        contracts.l2_messenger.sendMessage(resolver.address, b"")

    with ape.accounts.test_accounts.use_sender(caller):
        with ape.reverts("RestrictedCalls: call disallowed"):
            contracts.resolver.resolve(b"0", b"0", ape.chain.chain_id, ape.chain.chain_id, caller)

        with ape.reverts("RestrictedCalls: call disallowed"):
            contracts.resolver.resolve(
                b"0", b"0", ape.chain.chain_id, ape.chain.chain_id, ADDRESS_ZERO
            )

        with ape.reverts("RestrictedCalls: call disallowed"):
            contracts.l1_messenger.sendMessage(request_manager.address, b"")

        with ape.reverts("RestrictedCalls: call disallowed"):
            contracts.request_manager.resolveRequest(b"0", b"0", ape.chain.chain_id, caller)

        with ape.reverts("RestrictedCalls: messenger not set"):
            contracts.request_manager.resolveRequest(b"0", b"0", 0, caller)

        with ape.reverts("RestrictedCalls: messenger not set"):
            contracts.request_manager.invalidateFill(b"0", b"0", 0)
