import brownie
import pytest
from eth_abi.packed import encode_abi_packed
from eth_utils import keccak
from web3.constants import ADDRESS_ZERO

from beamer.tests.util import alloc_accounts, create_fill_hash


@pytest.mark.parametrize("amount", [100, 99, 101])
@pytest.mark.parametrize("forward_state", [True])
@pytest.mark.parametrize("use_correct_fill_id", [True, False])
def test_l1_resolution_correct_hash(
    fill_manager, deployer, resolution_registry, token, amount, use_correct_fill_id
):
    requested_amount = 100
    request_id = 23
    filler, receiver = alloc_accounts(2)
    chain_id = brownie.web3.eth.chain_id

    fill_manager.addAllowedLP(filler, {"from": deployer})

    token.mint(filler, amount, {"from": filler})
    token.approve(fill_manager.address, amount, {"from": filler})

    fill_tx = fill_manager.fillRequest(
        request_id, chain_id, token.address, receiver, amount, {"from": filler}
    )

    fill_id = fill_tx.return_value

    if not use_correct_fill_id:
        fill_id = keccak(b"wrong fill id")

    fill_hash = create_fill_hash(
        request_id,
        chain_id,
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


@pytest.mark.parametrize("forward_state", [True])
def test_l1_non_fill_proof(fill_manager, resolution_registry):
    request_id = 123
    request_hash = "1234" + "00" * 30
    fill_id = "5678" + "00" * 30
    chain_id = brownie.web3.eth.chain_id

    fill_manager.invalidateFillHash(request_id, request_hash, fill_id, chain_id)

    fill_hash = keccak(
        encode_abi_packed(
            ["bytes32", "bytes32"],
            [
                bytes.fromhex(request_hash),
                bytes.fromhex(fill_id),
            ],
        )
    )

    assert resolution_registry.invalidFillHashes(fill_hash)


def test_restricted_calls(contracts, resolver):
    """Test that important contract calls cannot be invoked by a random caller."""
    (caller,) = alloc_accounts(1)
    req_id = 123

    # fill_manager -> proof_submitter -> messenger1 -> L1 resolver ->
    # messenger2 -> resolution registry
    with brownie.reverts("RestrictedCalls: unknown caller"):
        contracts.proof_submitter.submitProof(
            resolver, brownie.chain.id, req_id, 0, caller, {"from": caller}
        )

    with brownie.reverts("XRestrictedCalls: unknown caller"):
        contracts.resolver.resolve(
            req_id, 0, brownie.chain.id, brownie.chain.id, caller, {"from": caller}
        )

    with brownie.reverts("XRestrictedCalls: unknown caller"):
        contracts.resolver.resolveNonFill(
            req_id, 0, brownie.chain.id, brownie.chain.id, {"from": caller}
        )

    with brownie.reverts("XRestrictedCalls: unknown caller"):
        contracts.resolution_registry.resolveRequest(req_id, 0, 0, caller, {"from": caller})

    with brownie.reverts("XRestrictedCalls: unknown caller"):
        contracts.resolution_registry.invalidateFillHash(req_id, 0, 0, {"from": caller})
