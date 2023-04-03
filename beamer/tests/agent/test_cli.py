import json
import pathlib
import shutil
import signal

import ape
import eth_account
import pytest
from click.testing import CliRunner

from beamer.agent.commands import agent
from beamer.agent.l1_resolution import get_relayer_executable


def _generate_deployment_dir(output_dir, root, contracts):
    data = {
        "beamer_commit": "0" * 40,
        "chains": {
            str(ape.chain.chain_id): {
                "RequestManager": {
                    "address": contracts.request_manager.address,
                    "deployment_block": 1,
                },
                "FillManager": {"address": contracts.fill_manager.address, "deployment_block": 1},
            }
        },
    }
    with output_dir.joinpath("deployment.json").open("wt") as f:
        json.dump(data, f)

    src = root / "contracts/.build"
    shutil.copy(src / "RequestManager.json", output_dir)
    shutil.copy(src / "FillManager.json", output_dir)


@pytest.fixture
def setup_relayer_executable():
    relayer = get_relayer_executable()
    if relayer.exists():
        yield
        return

    relayer.parent.mkdir(parents=True, exist_ok=True)
    relayer.write_text("")
    yield
    relayer.unlink()


_CONFIG_FILE = """
unsafe-fill-time = {unsafe_fill_time}
deployment-dir = "{deployment_dir}"
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


def _generate_options(keyfile, deployment_dir, config, unsafe_fill_time, confirmation_blocks):
    return (
        "--account-path",
        str(keyfile),
        "--account-password",
        "test",
        "--base-chain",
        str(config.base_chain_rpc_url),
        "--chain",
        f"l2a={config.rpc_urls['l2a']}",
        "--chain",
        f"l2b={config.rpc_urls['l2b']}",
        "--deployment-dir",
        str(deployment_dir),
        "--unsafe-fill-time",
        unsafe_fill_time,
        "--poll-period",
        config.poll_period,
        "--confirmation-blocks",
        confirmation_blocks,
    )


def _generate_options_config(
    keyfile, deployment_dir, config, unsafe_fill_time, confirmation_blocks
):
    content = _CONFIG_FILE.format(
        path=str(keyfile),
        base_chain_rpc_url=config.base_chain_rpc_url,
        foo_rpc_url=config.rpc_urls["l2a"],
        foo_confirmation_blocks=config.confirmation_blocks["l2a"],
        bar_rpc_url=config.rpc_urls["l2b"],
        deployment_dir=deployment_dir,
        unsafe_fill_time=unsafe_fill_time,
        poll_period=config.poll_period,
        foo_poll_period=0.2,
        confirmation_blocks=confirmation_blocks,
    )
    config_file = keyfile.parent / "agent.conf"
    config_file.write_text(content)
    return "-c", str(config_file)


@pytest.mark.parametrize("generate_options", (_generate_options, _generate_options_config))
@pytest.mark.parametrize("unsafe_fill_time_option", [(1, True), (1000000, False)])
@pytest.mark.usefixtures("setup_relayer_executable")
def test_cli(config, tmp_path, contracts, generate_options, unsafe_fill_time_option):
    key = "0x3ff6c8dfd3ab60a14f2a2d4650387f71fe736b519d990073e650092faaa621fa"
    acc = eth_account.Account.from_key(key)
    obj = eth_account.Account.encrypt(key, "test")
    keyfile = tmp_path / f"{acc.address}.json"
    keyfile.write_text(json.dumps(obj))
    root = pathlib.Path(__file__).parents[3]
    deployment_dir = tmp_path / "deployment"
    deployment_dir.mkdir()
    _generate_deployment_dir(deployment_dir, root, contracts)

    signal.signal(signal.SIGALRM, lambda *_unused: signal.raise_signal(signal.SIGINT))
    signal.setitimer(signal.ITIMER_REAL, 2)

    unsafe_time, error = unsafe_fill_time_option

    options = generate_options(
        keyfile, deployment_dir, config, unsafe_time, config.confirmation_blocks["l2a"]
    )
    runner = CliRunner()
    result = runner.invoke(agent, options)
    if not error:
        assert result.exit_code == 1
    else:
        assert result.exit_code == 0
