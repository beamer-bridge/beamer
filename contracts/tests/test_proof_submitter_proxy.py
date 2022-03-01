import brownie

from contracts.tests.conftest import Contracts
from contracts.tests.utils import alloc_accounts


def test_proxy_call(contracts: Contracts, resolver):
    """Test that the proxy call is properly forwarded.
    It should fail with proper error message as if not proxied."""
    (caller,) = alloc_accounts(1)

    with brownie.reverts("RestrictedCalls: unknown caller"):
        contracts.proxied_proof_submitter.submitProof(
            resolver, 0, brownie.chain.id, caller, {"from": caller}
        )


def test_change_implementation(contracts: Contracts, deployer):
    proxy = contracts.proof_submitter_proxy
    # Take an arbitrary address as new implementation
    newImplementation = contracts.fill_manager.address

    proxy.upgradeTo(newImplementation, {"from": deployer})
    assert proxy.getImplementation() == newImplementation


def test_change_implementation_not_admin(contracts: Contracts):
    (caller,) = alloc_accounts(1)

    proxy = contracts.proof_submitter_proxy
    # Take an arbitrary address as new implementation
    newImplementation = contracts.fill_manager.address

    with brownie.reverts("ProofSubmitterProxy: only admin can upgrade implementation"):
        proxy.upgradeTo(newImplementation, {"from": caller})


def test_change_admin(contracts: Contracts, deployer):
    proxy = contracts.proof_submitter_proxy
    # Take an arbitrary address as new admin
    (newAdmin,) = alloc_accounts(1)

    proxy.changeAdmin(newAdmin, {"from": deployer})
    assert proxy.getAdmin() == newAdmin


def test_change_admin_not_admin(contracts: Contracts):
    (caller,) = alloc_accounts(1)

    proxy = contracts.proof_submitter_proxy

    with brownie.reverts("ProofSubmitterProxy: only admin can change admin"):
        proxy.changeAdmin(caller, {"from": caller})
