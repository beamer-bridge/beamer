import pytest

from brownie import accounts


@pytest.fixture
def deployer():
    return accounts[0]


@pytest.fixture
def claim_stake():
    return 100


@pytest.fixture
def claim_period():
    return 100


@pytest.fixture
def challenge_period():
    return 100


@pytest.fixture
def challenge_period_extension():
    return 100


@pytest.fixture
def claim_manager(
    deployer, ClaimManager, claim_stake, claim_period, challenge_period, challenge_period_extension
):
    return deployer.deploy(
        ClaimManager, claim_stake, claim_period, challenge_period, challenge_period_extension
    )


@pytest.fixture
def l1_resolver():
    return "0x5d5640575161450A674a094730365A223B226641"


@pytest.fixture
def dummy_proof_submitter(deployer, DummyProofSubmitter):
    return deployer.deploy(DummyProofSubmitter)


@pytest.fixture
def fill_manager(deployer, FillManager, l1_resolver, dummy_proof_submitter):
    return deployer.deploy(FillManager, l1_resolver, dummy_proof_submitter.address)


@pytest.fixture
def token(deployer, MintableToken):
    return deployer.deploy(MintableToken, int(1e18))
