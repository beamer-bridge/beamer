import brownie
import pytest
from brownie import accounts, web3
from web3.constants import ADDRESS_ZERO

from contracts.tests.utils import create_request_hash


@pytest.mark.parametrize("amount", [100, 99, 101])
def test_l1_resolution_correct_amount(
    fill_manager, deployer, resolution_registry, token, resolver, amount
):
    requested_amount = 100
    request_id = 23
    filler = accounts[1]
    receiver = accounts[2]
    chain_id = web3.eth.chain_id

    correct_request_hash = create_request_hash(
        request_id, chain_id, token.address, receiver.address, requested_amount
    )

    fill_manager.addAllowedLP(filler, {"from": deployer})
    resolver.addRegistry(chain_id, resolution_registry.address, {"from": deployer})

    token.mint(filler, amount, {"from": filler})
    token.approve(fill_manager.address, amount, {"from": filler})

    assert resolution_registry.eligibleClaimers(correct_request_hash) == ADDRESS_ZERO

    fill_manager.fillRequest(
        chain_id, request_id, token.address, receiver, amount, {"from": filler}
    )
    if amount == requested_amount:
        assert resolution_registry.eligibleClaimers(correct_request_hash) == filler
    else:
        assert resolution_registry.eligibleClaimers(correct_request_hash) == ADDRESS_ZERO


def test_restricted_calls(contracts, resolver):
    """Test that important contract calls cannot be invoked by a random caller."""
    caller = accounts[3]

    # fill_manager -> proof_submitter -> messenger1 -> L1 resolver ->
    # messenger2 -> resolution registry
    with brownie.reverts("RestrictedCalls: unknown caller"):
        contracts.proof_submitter.submitProof(
            resolver, 0, brownie.chain.id, caller, {"from": caller}
        )

    with brownie.reverts("XRestrictedCalls: unknown caller"):
        contracts.resolver.resolve(0, brownie.chain.id, brownie.chain.id, caller, {"from": caller})

    with brownie.reverts("XRestrictedCalls: unknown caller"):
        contracts.resolution_registry.resolveRequest(0, 0, caller, {"from": caller})
