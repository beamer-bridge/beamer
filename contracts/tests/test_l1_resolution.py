import brownie
import pytest
from brownie import accounts, web3
from web3.constants import ADDRESS_ZERO
from contracts.tests.utils import create_fill_hash


@pytest.mark.parametrize("amount", [100, 99, 101])
@pytest.mark.parametrize("use_correct_fill_id", [True, False])
def test_l1_resolution_correct_hash(
    fill_manager, deployer, resolution_registry, token, amount, use_correct_fill_id
):
    requested_amount = 100
    request_id = 23
    filler = accounts[1]
    receiver = accounts[2]
    chain_id = web3.eth.chain_id

    fill_manager.addAllowedLP(filler, {"from": deployer})

    token.mint(filler, amount, {"from": filler})
    token.approve(fill_manager.address, amount, {"from": filler})

    fill_id = fill_manager.fillRequest(
        request_id, chain_id, token.address, receiver, amount, {"from": filler}
    ).return_value

    # This might need to be changed as we don't know what future fillIds can be there
    # For optimism it's block.number, but for others it's gonna be something different.
    # All we know is that fillId is currently typed as uint256
    if not use_correct_fill_id:
        fill_id -= 1

    fill_hash = create_fill_hash(
        request_id,
        chain_id,
        token.address,
        receiver.address,
        requested_amount,
        fill_id,
    )

    expected_address = ADDRESS_ZERO
    if amount == requested_amount and use_correct_fill_id:
        expected_address = filler

    assert resolution_registry.fillers(fill_hash) == expected_address


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
