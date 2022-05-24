import brownie
from brownie import web3
from eth_utils import to_bytes
from web3.constants import ADDRESS_ZERO

from beamer.tests.agent.utils import make_address
from beamer.tests.util import create_fill_hash


def test_invalidation_before_and_after_resolution(contracts, token, resolution_registry):
    contracts.l1_messenger.setLastSender(contracts.resolver.address)

    address = make_address()
    request_id = 1
    fill_id = to_bytes(b"123")
    chain_id = web3.eth.chain_id

    fill_hash = create_fill_hash(
        request_id,
        chain_id,
        chain_id,
        token.address,
        address,
        1,
        fill_id,
    )

    assert not resolution_registry.invalidFillHashes(fill_hash)
    resolution_registry.invalidateFillHash(fill_hash, chain_id, {"from": contracts.l1_messenger})
    # Fill hash must be invalidated
    assert resolution_registry.invalidFillHashes(fill_hash)

    assert resolution_registry.fillers(fill_hash) == ADDRESS_ZERO

    resolution_registry.resolveRequest(
        fill_hash, chain_id, address, {"from": contracts.l1_messenger}
    )

    # Resolution validates fill hash again
    assert resolution_registry.fillers(fill_hash) == address
    assert not resolution_registry.invalidFillHashes(fill_hash)

    # Invalidation of a resolved request should fail
    with brownie.reverts("Cannot invalidate resolved fillHashes"):
        resolution_registry.invalidateFillHash(
            fill_hash, chain_id, {"from": contracts.l1_messenger}
        )
