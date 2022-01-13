import os
import pathlib
import brownie
import eth_account

import pytest
from brownie import Wei, accounts

from raisync.node import Config, ContractInfo, Node
from raisync.typing import BlockNumber

# brownie local account, to be used for fulfilling requests.
# The private key here corresponds to the 10th account ganache creates on
# startup.
_LOCAL_ACCOUNT = accounts.add("0x3ff6c8dfd3ab60a14f2a2d4650387f71fe736b519d990073e650092faaa621fa")


@pytest.fixture
def request_manager(RequestManager):
    claim_stake = Wei("0.01 ether")
    claim_period = 60 * 60  # 1 hour
    challenge_period = 60 * 60 * 5  # 5 hours
    challenge_period_extension = 60 * 60  # 1 hour
    cancellation_period = 60 * 60  # 1 hour
    return accounts[0].deploy(
        RequestManager,
        claim_stake,
        claim_period,
        challenge_period,
        challenge_period_extension,
        cancellation_period,
    )


@pytest.fixture
def l1_resolver():
    return "0x5d5640575161450A674a094730365A223B226641"


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
def dummy_proof_submitter(DummyProofSubmitter):
    return accounts[0].deploy(DummyProofSubmitter)


@pytest.fixture
def fill_manager(FillManager, l1_resolver, dummy_proof_submitter):
    manager = accounts[0].deploy(FillManager, l1_resolver, dummy_proof_submitter.address)
    manager.addAllowedLP(_LOCAL_ACCOUNT)
    return manager


@pytest.fixture
def token(MintableToken):
    return accounts[0].deploy(MintableToken, int(1e18))
