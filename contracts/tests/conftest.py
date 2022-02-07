import pytest

from brownie import accounts


@pytest.fixture
def deployer():
    return accounts[0]


@pytest.fixture
def token(deployer, MintableToken):
    return deployer.deploy(MintableToken, int(1e18))


@pytest.fixture
def test_cross_domain_messenger(deployer, TestCrossDomainMessenger):
    contract = deployer.deploy(TestCrossDomainMessenger)
    contract.setForwardState(True)

    return contract


@pytest.fixture
def resolver(deployer, Resolver, test_cross_domain_messenger):
    return deployer.deploy(Resolver, test_cross_domain_messenger.address)


@pytest.fixture
def resolution_registry(deployer, ResolutionRegistry):
    return deployer.deploy(ResolutionRegistry)


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
def cancellation_period():
    return 100


@pytest.fixture
def request_manager(
    deployer,
    RequestManager,
    claim_stake,
    claim_period,
    challenge_period,
    challenge_period_extension,
    cancellation_period,
    resolution_registry,
):
    return deployer.deploy(
        RequestManager,
        claim_stake,
        claim_period,
        challenge_period,
        challenge_period_extension,
        cancellation_period,
        resolution_registry.address,
    )


@pytest.fixture
def optimism_proof_submitter(deployer, OptimismProofSubmitter, test_cross_domain_messenger):
    return deployer.deploy(OptimismProofSubmitter, test_cross_domain_messenger.address)


@pytest.fixture
def fill_manager(deployer, FillManager, resolver, optimism_proof_submitter):
    return deployer.deploy(FillManager, resolver, optimism_proof_submitter.address)
