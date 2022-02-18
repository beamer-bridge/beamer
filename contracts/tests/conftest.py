from dataclasses import dataclass

import brownie
import pytest
from brownie import (
    FillManager,
    OptimismProofSubmitter,
    RequestManager,
    ResolutionRegistry,
    Resolver,
    TestCrossDomainMessenger,
)

from contracts.tests.utils import alloc_accounts


@dataclass(frozen=True)
class Contracts:
    resolver: Resolver
    fill_manager: FillManager
    request_manager: RequestManager
    messenger1: TestCrossDomainMessenger
    messenger2: TestCrossDomainMessenger
    proof_submitter: OptimismProofSubmitter
    resolution_registry: ResolutionRegistry


@pytest.fixture
def deployer():
    return alloc_accounts(1)[0]


@pytest.fixture
def token(deployer, MintableToken):
    return deployer.deploy(MintableToken, int(1e18))


@pytest.fixture
def claim_stake():
    return 100


@pytest.fixture
def claim_period():
    return 100


@pytest.fixture
def challenge_period():
    return 200


@pytest.fixture
def challenge_period_extension():
    return 50


@pytest.fixture
def contracts(deployer, claim_stake, claim_period, challenge_period, challenge_period_extension):
    # L2b contracts
    messenger1 = deployer.deploy(TestCrossDomainMessenger)
    messenger1.setForwardState(True)

    # L1 contracts
    messenger2 = deployer.deploy(TestCrossDomainMessenger)
    messenger2.setForwardState(True)
    resolver = deployer.deploy(Resolver)

    # L2b contracts, again
    proof_submitter = deployer.deploy(OptimismProofSubmitter, messenger1.address)
    fill_manager = deployer.deploy(FillManager, resolver.address, proof_submitter.address)

    # L2a contracts
    resolution_registry = deployer.deploy(ResolutionRegistry)
    request_manager = deployer.deploy(
        RequestManager,
        claim_stake,
        claim_period,
        challenge_period,
        challenge_period_extension,
        resolution_registry.address,
    )

    # Explicitly allow calls between contracts. The chain of trust:
    #
    # fill_manager -> proof_submitter -> messenger1 -> L1 resolver ->
    # messenger2 -> resolution registry
    l1_chain_id = l2_chain_id = brownie.chain.id

    proof_submitter.addCaller(l2_chain_id, fill_manager.address)
    resolver.addCaller(l2_chain_id, messenger1.address, proof_submitter.address)
    resolution_registry.addCaller(l1_chain_id, messenger2.address, resolver.address)

    resolver.addRegistry(l2_chain_id, resolution_registry.address, messenger2.address)
    return Contracts(
        messenger1=messenger1,
        messenger2=messenger2,
        resolver=resolver,
        proof_submitter=proof_submitter,
        fill_manager=fill_manager,
        request_manager=request_manager,
        resolution_registry=resolution_registry,
    )


@pytest.fixture
def request_manager(contracts):
    return contracts.request_manager


@pytest.fixture
def test_cross_domain_messenger(contracts):
    return contracts.messenger


@pytest.fixture
def resolver(contracts):
    return contracts.resolver


@pytest.fixture
def resolution_registry(contracts):
    return contracts.resolution_registry


@pytest.fixture
def optimism_proof_submitter(contracts):
    return contracts.proof_submitter


@pytest.fixture
def fill_manager(contracts):
    return contracts.fill_manager
