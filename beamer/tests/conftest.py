import os
import pathlib
from dataclasses import dataclass

import brownie
import eth_account
import pytest
from brownie import (
    FillManager,
    RequestManager,
    ResolutionRegistry,
    Resolver,
    TestL1Messenger,
    TestL2Messenger,
    TestProofSubmitter,
    accounts,
)

import beamer.metrics
from beamer.agent import Agent
from beamer.config import Config
from beamer.contracts import ContractInfo
from beamer.tests.util import alloc_accounts
from beamer.typing import BlockNumber


@dataclass(frozen=True)
class Contracts:
    resolver: Resolver
    fill_manager: FillManager
    request_manager: RequestManager
    l1_messenger: TestL1Messenger
    l2_messenger: TestL2Messenger
    proof_submitter: TestProofSubmitter
    resolution_registry: ResolutionRegistry


# brownie local account, to be used for fulfilling requests.
# The private key here corresponds to the 10th account ganache creates on
# startup.
_LOCAL_ACCOUNT = accounts.add("0x3ff6c8dfd3ab60a14f2a2d4650387f71fe736b519d990073e650092faaa621fa")


@pytest.fixture
def deployer():
    return alloc_accounts(1)[0]


# Make sure that the chain is reset after each test since brownie
# launches ganache only once for the entire test suite run.
@pytest.fixture(autouse=True)
def _reset_chain():
    yield
    brownie.chain.reset()


@pytest.fixture
def claim_stake():
    return 100


@pytest.fixture
def claim_period():
    return 100


@pytest.fixture
def finalization_time():
    return 200


@pytest.fixture
def challenge_period_extension():
    return 50


@pytest.fixture
def forward_state():
    return False


@pytest.fixture
def contracts(
    deployer,
    forward_state,
    claim_stake,
    claim_period,
    finalization_time,
    challenge_period_extension,
):
    # L1 contracts
    l1_messenger = deployer.deploy(TestL1Messenger)
    l1_messenger.setForwardState(forward_state)
    resolver = deployer.deploy(Resolver)

    # L2b contracts
    l2_messenger = deployer.deploy(TestL2Messenger)
    l2_messenger.setForwardState(forward_state)
    proof_submitter = deployer.deploy(TestProofSubmitter, l2_messenger.address)
    fill_manager = deployer.deploy(FillManager, resolver.address, proof_submitter.address)
    fill_manager.addAllowedLP(_LOCAL_ACCOUNT)

    # L2a contracts
    resolution_registry = deployer.deploy(ResolutionRegistry)
    request_manager = deployer.deploy(
        RequestManager,
        claim_stake,
        claim_period,
        challenge_period_extension,
        resolution_registry.address,
    )

    # Explicitly allow calls between contracts. The chain of trust:
    #
    # fill_manager -> proof_submitter -> L2 messenger -> L1 resolver ->
    # L1 messenger -> resolution registry
    l1_chain_id = l2_chain_id = brownie.chain.id

    proof_submitter.addCaller(l2_chain_id, fill_manager.address)
    l2_messenger.addCaller(l2_chain_id, proof_submitter.address)
    resolver.addCaller(l2_chain_id, l2_messenger.address, proof_submitter.address)
    l1_messenger.addCaller(l1_chain_id, resolver.address)
    resolution_registry.addCaller(l1_chain_id, l1_messenger.address, resolver.address)
    resolver.addRegistry(l2_chain_id, resolution_registry.address, l1_messenger.address)

    request_manager.setFinalizationTime(l2_chain_id, finalization_time)
    return Contracts(
        l1_messenger=l1_messenger,
        l2_messenger=l2_messenger,
        resolver=resolver,
        proof_submitter=proof_submitter,
        fill_manager=fill_manager,
        request_manager=request_manager,
        resolution_registry=resolution_registry,
    )


@pytest.fixture
def config(request_manager, fill_manager, resolution_registry, token):
    root = pathlib.Path(__file__).parents[2]
    token_match_file = root / "beamer/data/tokens.example.json"

    contracts_info = dict(
        RequestManager=ContractInfo(
            deployment_block=BlockNumber(1),
            address=request_manager.address,
            abi=request_manager.abi,
        ),
        FillManager=ContractInfo(
            deployment_block=BlockNumber(1), address=fill_manager.address, abi=fill_manager.abi
        ),
        ResolutionRegistry=ContractInfo(
            deployment_block=BlockNumber(1),
            address=resolution_registry.address,
            abi=resolution_registry.abi,
        ),
    )
    deployment_info = {brownie.chain.id: contracts_info}
    account = eth_account.Account.from_key(_LOCAL_ACCOUNT.private_key)
    token.mint(account.address, 300)
    url = brownie.web3.provider.endpoint_uri
    config = Config(
        l1_rpc_url=url,
        l2a_rpc_url=url,
        l2b_rpc_url=url,
        deployment_info=deployment_info,
        token_match_file=token_match_file,
        account=account,
        fill_wait_time=0,
        prometheus_metrics_port=None,
    )
    beamer.metrics.init(config)
    return config


@pytest.fixture
def allow_unlisted_pairs() -> bool:
    return True


@pytest.fixture
def set_allow_unlisted_pairs(allow_unlisted_pairs: bool) -> None:
    if allow_unlisted_pairs:
        os.environ["BEAMER_ALLOW_UNLISTED_PAIRS"] = "1"
    else:
        if os.environ.get("BEAMER_ALLOW_UNLISTED_PAIRS") is not None:
            del os.environ["BEAMER_ALLOW_UNLISTED_PAIRS"]


@pytest.fixture
def agent(config, set_allow_unlisted_pairs):  # pylint:disable=unused-argument
    agent = Agent(config)
    agent.start()
    yield agent
    agent.stop()


@pytest.fixture
def token(deployer, MintableToken):
    return deployer.deploy(MintableToken, int(1e18))


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
