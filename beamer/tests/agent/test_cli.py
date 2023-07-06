import json
import shutil
import signal

import ape
import eth_account
import pytest
from click.testing import CliRunner
from web3.constants import ADDRESS_ZERO

from beamer.agent.commands import agent

from beamer.tests.util import get_repo_root


def _generate_deployment_dir(deployment_dir, contracts):
    root = get_repo_root()
    artifacts_dir = deployment_dir / "artifacts"
    abi_dir = deployment_dir / "abis"
    artifacts_dir.mkdir()
    abi_dir.mkdir()
    data = {
        "deployer": ADDRESS_ZERO,
        "base": {"chain_id": ape.chain.chain_id},
        "chain": {
            "chain_id": ape.chain.chain_id,
            "RequestManager": {
                "beamer_commit": "0" * 40,
                "tx_hash": contracts.request_manager.txn_hash,
                "address": contracts.request_manager.address,
                "deployment_block": 1,
                "deployment_args": [],
            },
            "FillManager": {
                "beamer_commit": "0" * 40,
                "tx_hash": contracts.fill_manager.txn_hash,
                "address": contracts.fill_manager.address,
                "deployment_block": 1,
                "deployment_args": [],
            },
        },
    }
    with artifacts_dir.joinpath("1337-ethereum.deployment.json").open("wt") as f:
        json.dump(data, f)

    src = root / "contracts/.build"
    shutil.copy(src / "RequestManager.json", abi_dir)
    shutil.copy(src / "FillManager.json", abi_dir)


_CONFIG_FILE = """
unsafe-fill-time = {unsafe_fill_time}
artifacts-dir = "{artifacts_dir}"
abi-dir = "{abi_dir}"
poll-period = {poll_period}
confirmation-blocks = {confirmation_blocks}

[account]
path = "{path}"
password = "test"

[base-chain]
rpc-url = "{base_chain_rpc_url}"

[chains.foo]
rpc-url = "{foo_rpc_url}"
poll-period = {foo_poll_period}
confirmation-blocks = {foo_confirmation_blocks}

[chains.bar]
rpc-url = "{bar_rpc_url}"

[tokens]
"""


def _generate_options(
    keyfile, artifacts_dir, abi_dir, config, unsafe_fill_time, confirmation_blocks
):
    return (
        "--account-path",
        str(keyfile),
        "--account-password",
        "test",
        "--base-chain",
        str(config.base_chain_rpc_url),
        "--chain",
        f"l2a={config.chains['l2a'].rpc_url}",
        "--chain",
        f"l2b={config.chains['l2b'].rpc_url}",
        "--artifacts-dir",
        str(artifacts_dir),
        "--abi-dir",
        str(abi_dir),
        "--unsafe-fill-time",
        unsafe_fill_time,
        "--poll-period",
        config.chains["l2a"].poll_period,
        "--confirmation-blocks",
        confirmation_blocks,
    )


def _generate_options_config(
    keyfile, artifacts_dir, abi_dir, config, unsafe_fill_time, confirmation_blocks
):
    content = _CONFIG_FILE.format(
        path=str(keyfile),
        base_chain_rpc_url=config.base_chain_rpc_url,
        foo_rpc_url=config.chains["l2a"].rpc_url,
        foo_confirmation_blocks=config.chains["l2a"].confirmation_blocks,
        bar_rpc_url=config.chains["l2b"].rpc_url,
        artifacts_dir=artifacts_dir,
        abi_dir=abi_dir,
        unsafe_fill_time=unsafe_fill_time,
        poll_period=config.chains["l2a"].poll_period,
        foo_poll_period=0.2,
        confirmation_blocks=confirmation_blocks,
    )
    config_file = keyfile.parent / "agent.conf"
    config_file.write_text(content)
    return "-c", str(config_file)


@pytest.mark.parametrize("generate_options", (_generate_options, _generate_options_config))
@pytest.mark.parametrize("unsafe_fill_time_option", [(1, True), (1000000, False)])
@pytest.mark.usefixtures("setup_relayer_executable")
def test_cli(
    config,
    tmp_path,
    contracts,
    generate_options,
    unsafe_fill_time_option,
):
    key = "0x3ff6c8dfd3ab60a14f2a2d4650387f71fe736b519d990073e650092faaa621fa"
    acc = eth_account.Account.from_key(key)
    obj = eth_account.Account.encrypt(key, "test")
    keyfile = tmp_path / f"{acc.address}.json"
    keyfile.write_text(json.dumps(obj))
    deployment_dir = tmp_path / "deployment"
    deployment_dir.mkdir()
    artifacts_dir = deployment_dir / "artifacts"
    abi_dir = deployment_dir / "abis"
    _generate_deployment_dir(deployment_dir, contracts)

    signal.signal(signal.SIGALRM, lambda *_unused: signal.raise_signal(signal.SIGINT))
    signal.setitimer(signal.ITIMER_REAL, 2)

    unsafe_time, error = unsafe_fill_time_option

    options = generate_options(
        keyfile,
        artifacts_dir,
        abi_dir,
        config,
        unsafe_time,
        config.chains["l2a"].confirmation_blocks,
    )
    runner = CliRunner()
    result = runner.invoke(agent, options)
    if not error:
        assert result.exit_code == 1
    else:
        assert result.exit_code == 0
