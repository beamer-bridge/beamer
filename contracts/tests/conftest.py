import pytest

from brownie import accounts

@pytest.fixture
def claim_stake():
    return 100

@pytest.fixture
def claim_manager(ClaimManager, claim_stake):
    return ClaimManager.deploy(100, 100, 100, 100, {"from": accounts[0]})