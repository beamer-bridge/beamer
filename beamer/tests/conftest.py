# flake8: noqa: E402
from dataclasses import dataclass

import ape
import pytest
from beamer.tests.util import alloc_accounts


@dataclass(frozen=True)
class Contracts:
    resolver: ape.project.Resolver
    fill_manager: ape.project.FillManager
    request_manager: ape.project.RequestManager
    l1_messenger: ape.project.TestL1Messenger
    l2_messenger: ape.project.TestL2Messenger


# ape local account, to be used for fulfilling requests.
# The private key here corresponds to the 10th account ganache creates on
# startup.
@pytest.fixture
def local_account():
    return ape.accounts.test_accounts[-1]


@pytest.fixture
def deployer():
    return alloc_accounts(1)[0]


@pytest.fixture(autouse=True)
def _add_default_sender(deployer):
    with ape.accounts.use_sender(deployer):
        yield


# Point XDG_ directories to alternate locations to
# avoid interference with real locations. We're using
# only XDG_STATE_HOME for now.
@pytest.fixture(autouse=True)
def _set_xdg_dirs(tmpdir, monkeypatch):
    monkeypatch.setenv("XDG_STATE_HOME", str(tmpdir))


# Make sure that the chain is reset after each test since ape
# launches ganache only once for the entire test suite run.
@pytest.fixture(autouse=True)
def _reset_chain():
    snap_id = ape.chain.snapshot()
    yield
    ape.chain.restore(snap_id)


@pytest.fixture
def claim_stake():
    return 100


@pytest.fixture
def claim_request_extension():
    return 100


@pytest.fixture
def claim_period():
    return 100


@pytest.fixture
def challenge_period_extension():
    return 50


@pytest.fixture()
def request_manager_params(
    claim_stake, claim_request_extension, claim_period, challenge_period_extension
):
    return (
        claim_stake,
        claim_request_extension,
        claim_period,
        challenge_period_extension,
    )


@pytest.fixture
def min_fee_ppm():
    return 300_000


@pytest.fixture
def lp_fee_ppm():
    return 0


@pytest.fixture
def protocol_fee_ppm():
    return 0


@pytest.fixture
def fees_params(min_fee_ppm, lp_fee_ppm, protocol_fee_ppm):
    return min_fee_ppm, lp_fee_ppm, protocol_fee_ppm


@pytest.fixture
def finality_period():
    return 200


@pytest.fixture
def transfer_cost():
    return 0


@pytest.fixture
def target_weight_ppm():
    return 300_000


@pytest.fixture
def chain_params(finality_period, transfer_cost, target_weight_ppm):
    return finality_period, transfer_cost, target_weight_ppm


@pytest.fixture
def token_params():
    return int(10_000e18), int(1_500e18)


@pytest.fixture
def forward_state():
    return False


@pytest.fixture
def contracts(
    deployer,
    token,
    forward_state,
    request_manager_params,
    fees_params,
    chain_params,
    token_params,
    local_account,
):
    # L1 contracts
    l1_messenger = deployer.deploy(ape.project.TestL1Messenger)
    l1_messenger.setForwardState(forward_state)
    resolver = deployer.deploy(ape.project.Resolver)

    # L2b contracts
    l2_messenger = deployer.deploy(ape.project.TestL2Messenger)
    l2_messenger.setForwardState(forward_state)
    fill_manager = deployer.deploy(ape.project.FillManager, l2_messenger.address)
    fill_manager.setResolver(resolver.address)

    # L2a contracts
    request_manager = deployer.deploy(ape.project.RequestManager, *request_manager_params)

    # Add allowed LPs
    fill_manager.addAllowedLp(local_account)
    request_manager.addAllowedLp(local_account)

    # Explicitly allow calls between contracts. The chain of trust:
    #
    # fill_manager -> L2 messenger -> L1 resolver ->
    # L1 messenger -> request_manager
    l1_chain_id = l2_chain_id = ape.chain.chain_id

    l2_messenger.addCaller(fill_manager.address)
    resolver.addCaller(l2_chain_id, l2_messenger.address, l1_messenger.address)
    l1_messenger.addCaller(resolver.address)
    request_manager.addCaller(l1_chain_id, l1_messenger.address, l2_messenger.address)
    resolver.addRequestManager(l2_chain_id, request_manager.address, l1_messenger.address)
    request_manager.updateFees(*fees_params)
    request_manager.updateChain(l2_chain_id, *chain_params)
    request_manager.updateToken(token.address, *token_params)

    return Contracts(
        l1_messenger=l1_messenger,
        l2_messenger=l2_messenger,
        resolver=resolver,
        fill_manager=fill_manager,
        request_manager=request_manager,
    )


@pytest.fixture()
def allowance():
    return None


@pytest.fixture()
def token_list(token, allowance):
    if allowance is None:
        return [[[ape.chain.chain_id, token.address]]]
    return [[[ape.chain.chain_id, token.address, allowance]]]


@pytest.fixture
def token(deployer):
    return deployer.deploy(ape.project.MintableToken, int(1e18))


@pytest.fixture
def request_manager(contracts):
    return contracts.request_manager


@pytest.fixture
def l1_messenger(contracts):
    return contracts.l1_messenger


@pytest.fixture
def resolver(contracts):
    return contracts.resolver


@pytest.fixture
def fill_manager(contracts):
    return contracts.fill_manager


@pytest.fixture
def fee_sub(deployer, request_manager, token):
    fee_sub = deployer.deploy(ape.project.FeeSub, request_manager.address)
    fee_sub.setMinimumAmount(token.address, 2)
    token.transfer(fee_sub.address, 100)
    return fee_sub
