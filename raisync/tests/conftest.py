import brownie
import eth_account
import pytest
from brownie import Wei, accounts

import raisync.node

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
    return accounts[0].deploy(
        RequestManager, claim_stake, claim_period, challenge_period, challenge_period_extension
    )


@pytest.fixture
def l1_resolver():
    return "0x5d5640575161450A674a094730365A223B226641"


@pytest.fixture
def node(request_manager, fill_manager, token):
    contracts_info = dict(
        RequestManager=(dict(blockHeight=0, address=request_manager.address), request_manager.abi),
        FillManager=(dict(blockHeight=0, address=fill_manager.address), fill_manager.abi),
    )
    account = eth_account.Account.from_key(_LOCAL_ACCOUNT.private_key)
    token.mint(account.address, 300)
    url = brownie.web3.provider.endpoint_uri
    config = raisync.node.Config(
        l2a_rpc_url=url, l2b_rpc_url=url, contracts_info=contracts_info, account=account
    )
    return raisync.node.Node(config)


@pytest.fixture
def dummy_proof_submitter(DummyProofSubmitter):
    return accounts[0].deploy(DummyProofSubmitter)


@pytest.fixture
def fill_manager(FillManager, l1_resolver, dummy_proof_submitter):
    return accounts[0].deploy(FillManager, l1_resolver, dummy_proof_submitter.address)


@pytest.fixture
def token(MintableToken):
    return accounts[0].deploy(MintableToken, int(1e18))
