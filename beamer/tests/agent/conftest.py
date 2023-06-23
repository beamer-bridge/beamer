import stat
from typing import cast

import ape
import eth_account
import pytest

import beamer.agent.chain
import beamer.agent.metrics
from beamer.agent.agent import Agent
from beamer.agent.config import ChainConfig, Config
from beamer.agent.relayer import get_relayer_executable
from beamer.agent.util import TokenChecker
from beamer.contracts import ContractInfo, DeploymentInfo
from beamer.typing import URL, BlockNumber, ChainId, TransferDirection


@pytest.fixture
def config(request_manager, fill_manager, token, token_list, local_account):
    contracts_info = dict(
        RequestManager=ContractInfo(
            deployment_block=BlockNumber(1),
            address=request_manager.address,
            abi=[abi.dict() for abi in request_manager.contract_type.abi],
        ),
        FillManager=ContractInfo(
            deployment_block=BlockNumber(1),
            address=fill_manager.address,
            abi=[abi.dict() for abi in fill_manager.contract_type.abi],
        ),
    )
    deployment_info = cast(DeploymentInfo, {ape.chain.chain_id: contracts_info})
    account = eth_account.Account.from_key(local_account.private_key)
    token.mint(account.address, 300)
    url = URL(ape.config.provider.uri)
    chains = {}
    for chain_name in ("l2a", "l2b"):
        chains[chain_name] = ChainConfig(
            rpc_url=url,
            min_source_balance=0,
            confirmation_blocks=0,
            poll_period=0.5,
        )

    config = Config(
        deployment_info=deployment_info,
        token_checker=TokenChecker(token_list),
        account=account,
        fill_wait_time=0,
        unsafe_fill_time=600,
        prometheus_metrics_port=None,
        base_chain_rpc_url=url,
        log_level="debug",
        chains=chains,
    )
    beamer.agent.metrics.init(config=config, source_rpc_url=url, target_rpc_url=url)
    return config


@pytest.fixture
def agent(config):  # pylint:disable=unused-argument
    agent = Agent(config)
    agent.start()
    yield agent
    agent.stop()


@pytest.fixture
def direction():
    return TransferDirection(ChainId(ape.chain.chain_id), ChainId(ape.chain.chain_id))


@pytest.fixture
def setup_relayer_executable():
    relayer = get_relayer_executable()
    relayer.parent.mkdir(parents=True, exist_ok=True)
    relayer.write_text("#!/bin/sh\nsleep 5\necho 'hello'")
    relayer.chmod(relayer.stat().st_mode | stat.S_IEXEC)
    yield
    relayer.unlink()
