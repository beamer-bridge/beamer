import pytest

from brownie import accounts


@pytest.fixture
def claim_stake():
    return 100


@pytest.fixture
def claim_manager(ClaimManager, claim_stake):
    return accounts[0].deploy(ClaimManager, claim_stake, 100, 100, 100)


@pytest.fixture
def l1_resolver():
    return "0x5d5640575161450A674a094730365A223B226641"


@pytest.fixture
def dummy_proof_writer(DummyProofWriter):
    return accounts[0].deploy(DummyProofWriter)


@pytest.fixture
def fill_manager(FillManager, l1_resolver, dummy_proof_writer):
    return accounts[0].deploy(FillManager, l1_resolver, dummy_proof_writer.address)


@pytest.fixture
def token(TestToken):
    return accounts[0].deploy(TestToken, int(1e18))
