import brownie
from brownie import web3
from web3.constants import ADDRESS_ZERO

from beamer.tests.agent.utils import make_address
from beamer.tests.constants import FILL_ID
from beamer.tests.util import create_fill_hash_from_request_id
from beamer.typing import RequestId


def test_invalidation_before_and_after_resolution(contracts, resolution_registry):
    contracts.l1_messenger.setLastSender(contracts.resolver.address)

    address = make_address()
    request_id = RequestId(31 * b"0" + b"1")
    chain_id = web3.eth.chain_id

    fill_hash = create_fill_hash_from_request_id(
        request_id,
        FILL_ID,
    )

    assert not resolution_registry.invalidFillHashes(fill_hash)
    resolution_registry.invalidateFill(
        request_id, FILL_ID, chain_id, {"from": contracts.l1_messenger}
    )

    # Fill hash must be invalidated
    assert resolution_registry.invalidFillHashes(fill_hash)

    assert resolution_registry.fillers(request_id)[0] == ADDRESS_ZERO

    resolution_registry.resolveRequest(
        request_id, FILL_ID, chain_id, address, {"from": contracts.l1_messenger}
    )

    # Resolution validates fill hash again
    assert resolution_registry.fillers(request_id)[0] == address
    assert not resolution_registry.invalidFillHashes(fill_hash)

    # Invalidation of a resolved request should fail
    with brownie.reverts("Cannot invalidate resolved fillHashes"):
        resolution_registry.invalidateFill(
            request_id, FILL_ID, chain_id, {"from": contracts.l1_messenger}
        )
