import stat

import ape
import eth_account
import pytest

import beamer.agent.metrics
from beamer.agent.agent import Agent
from beamer.agent.config import ChainConfig, Config
from beamer.agent.util import TokenChecker
from beamer.relayer import get_relayer_executable
from beamer.tests.agent.util import generate_abi_files, generate_artifacts
from beamer.typing import URL, ChainId, TransferDirection


@pytest.fixture
def config(tmp_path, contracts, token, token_list, local_account):
    abi_dir = tmp_path / "abis"
    artifacts_dir = tmp_path / "artifacts"
    generate_abi_files(abi_dir)
    generate_artifacts(artifacts_dir, contracts)

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
        abi_dir=abi_dir,
        artifacts_dir=artifacts_dir,
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


@pytest.fixture
def setup_relayer_executable_with_error():
    relayer = get_relayer_executable()
    relayer.parent.mkdir(parents=True, exist_ok=True)
    relayer.write_text("#!/bin/sh\nsleep 5\nexit 1")
    relayer.chmod(relayer.stat().st_mode | stat.S_IEXEC)
    yield
    relayer.unlink()
