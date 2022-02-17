import os
import pathlib
from dataclasses import dataclass

import brownie
import eth_account
import pytest
from brownie import (
    FillManager,
    OptimismProofSubmitter,
    RequestManager,
    ResolutionRegistry,
    Resolver,
    TestCrossDomainMessenger,
    Wei,
    accounts,
)

from raisync.node import Config, ContractInfo, Node
from raisync.typing import BlockNumber


@dataclass(frozen=True)
class Contracts:
    resolver: Resolver
    fill_manager: FillManager
    request_manager: RequestManager
    messenger1: TestCrossDomainMessenger
    messenger2: TestCrossDomainMessenger
    proof_submitter: OptimismProofSubmitter
    resolution_registry: ResolutionRegistry


# brownie local account, to be used for fulfilling requests.
# The private key here corresponds to the 10th account ganache creates on
# startup.
_LOCAL_ACCOUNT = accounts.add("0x3ff6c8dfd3ab60a14f2a2d4650387f71fe736b519d990073e650092faaa621fa")


@pytest.fixture
def deployer():
    return accounts[0]


# Make sure that the chain is reset after each test since brownie
# launches ganache only once for the entire test suite run.
@pytest.fixture(autouse=True)
def _reset_chain():
    yield
    brownie.chain.reset()


@pytest.fixture
def contracts(deployer):
    # L2b contracts
    messenger1 = deployer.deploy(TestCrossDomainMessenger)
    messenger1.setForwardState(False)

    # L1 contracts
    messenger2 = deployer.deploy(TestCrossDomainMessenger)
    messenger2.setForwardState(False)
    resolver = deployer.deploy(Resolver)

    # L2b contracts, again
    proof_submitter = deployer.deploy(OptimismProofSubmitter, messenger1.address)
    fill_manager = deployer.deploy(FillManager, resolver.address, proof_submitter.address)
    fill_manager.addAllowedLP(_LOCAL_ACCOUNT)

    # L2a contracts
    resolution_registry = deployer.deploy(ResolutionRegistry)
    claim_stake = Wei("0.01 ether")
    claim_period = 60 * 60  # 1 hour
    challenge_period = 60 * 60 * 5  # 5 hours
    challenge_period_extension = 60 * 60  # 1 hour
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
def config(request_manager, fill_manager, token):
    root = pathlib.Path(__file__).parents[2]
    token_match_file = root / "raisync/data/tokens.example.json"

    contracts_info = dict(
        RequestManager=ContractInfo(
            deployment_block=BlockNumber(0),
            address=request_manager.address,
            abi=request_manager.abi,
        ),
        FillManager=ContractInfo(
            deployment_block=BlockNumber(0), address=fill_manager.address, abi=fill_manager.abi
        ),
    )
    account = eth_account.Account.from_key(_LOCAL_ACCOUNT.private_key)
    token.mint(account.address, 300)
    url = brownie.web3.provider.endpoint_uri
    config = Config(
        l2a_rpc_url=url,
        l2b_rpc_url=url,
        l2a_contracts_info=contracts_info,
        l2b_contracts_info=contracts_info,
        token_match_file=token_match_file,
        account=account,
    )
    return config


@pytest.fixture
def allow_unlisted_pairs() -> bool:
    return True


@pytest.fixture
def set_allow_unlisted_pairs(allow_unlisted_pairs: bool) -> None:
    if allow_unlisted_pairs:
        os.environ["RAISYNC_ALLOW_UNLISTED_PAIRS"] = "1"
    else:
        if os.environ.get("RAISYNC_ALLOW_UNLISTED_PAIRS") is not None:
            del os.environ["RAISYNC_ALLOW_UNLISTED_PAIRS"]


@pytest.fixture
def node(config, set_allow_unlisted_pairs):  # pylint:disable=unused-argument
    node = Node(config)
    node.start()
    yield node
    node.stop()


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
