import json
import pathlib
import shutil
import signal

import brownie
import eth_account
import pytest
from click.testing import CliRunner

from beamer.cli import main
from beamer.l1_resolution import get_relayer_executable
from beamer.util import TokenMatchChecker


def _generate_deployment_dir(output_dir, root, contracts):
    data = {
        "beamer_commit": "0" * 40,
        "L2": {
            str(brownie.chain.id): {
                "RequestManager": {
                    "address": contracts.request_manager.address,
                    "deployment_block": 1,
                },
                "FillManager": {"address": contracts.fill_manager.address, "deployment_block": 1},
                "ResolutionRegistry": {
                    "address": contracts.resolution_registry.address,
                    "deployment_block": 1,
                },
            }
        },
    }
    with output_dir.joinpath("deployment.json").open("wt") as f:
        json.dump(data, f)

    src = root / "contracts/build/contracts"
    shutil.copy(src / "RequestManager.json", output_dir)
    shutil.copy(src / "FillManager.json", output_dir)
    shutil.copy(src / "ResolutionRegistry.json", output_dir)


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
source-chain = "foo"
target-chain = "bar"
deployment-dir = "{deployment_dir}"

[account]
path = "{path}"
password = "test"

[chains.l1]
rpc-url = "{l1_rpc_url}"

[chains.foo]
rpc-url = "{foo_rpc_url}"

[chains.bar]
rpc-url = "{bar_rpc_url}"

[tokens]
"""


def _generate_options(keyfile, deployment_dir, config):
    return (
        "--account-path",
        str(keyfile),
        "--account-password",
        "test",
        "--chain",
        f"l1={config.l1_rpc_url}",
        "--chain",
        f"l2a={config.l2a_rpc_url}",
        "--chain",
        f"l2b={config.l2b_rpc_url}",
        "--deployment-dir",
        str(deployment_dir),
        "--source-chain",
        "l2a",
        "--target-chain",
        "l2b",
    )


def _generate_options_config(keyfile, deployment_dir, config):
    content = _CONFIG_FILE.format(
        path=str(keyfile),
        l1_rpc_url=config.l1_rpc_url,
        foo_rpc_url=config.l2a_rpc_url,
        bar_rpc_url=config.l2b_rpc_url,
        deployment_dir=deployment_dir,
    )
    config_file = keyfile.parent / "agent.conf"
    config_file.write_text(content)
    return "-c", str(config_file)


@pytest.mark.parametrize("generate_options", (_generate_options, _generate_options_config))
@pytest.mark.usefixtures("setup_relayer_executable")
def test_cli(config, tmp_path, contracts, generate_options):
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

    options = generate_options(keyfile, deployment_dir, config)
    runner = CliRunner()
    result = runner.invoke(main, options)
    print(result.output)
    assert result.exit_code == 0


@pytest.mark.parametrize(
    "token_chain_ids_validity",
    [(["28", "588"], True), (["10", "42161", "288"], True), (["10", "28", "588"], False)],
)
def test_token_lists_validity(token_chain_ids_validity):
    token_address = "0x0000000000000000000000000000000000000001"
    token_chain_ids, valid = token_chain_ids_validity
    tokens = [
        # Parametrized token map
        [[chain_id, token_address] for chain_id in token_chain_ids],
        # Valid token map
        [
            ["28", "0x2De6a0f9dDFCb338AF1a126Dc77af9a245bBc83d"],
            ["588", "0xD184D3515e1817DDE870a2F30DEC29a8f1192414"],
        ],
    ]

    if not valid:
        with pytest.raises(AssertionError):
            TokenMatchChecker(tokens)
    else:
        TokenMatchChecker(tokens)
