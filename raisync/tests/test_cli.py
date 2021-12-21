import json
import pathlib
import signal

import eth_account

from click.testing import CliRunner
from raisync.cli import main


def test_cli(config, tmp_path):
    key = "0x3ff6c8dfd3ab60a14f2a2d4650387f71fe736b519d990073e650092faaa621fa"
    acc = eth_account.Account.from_key(key)
    obj = eth_account.account.create_keyfile_json(acc.key, b"")
    keyfile = tmp_path / f"{acc.address}.json"
    keyfile.write_text(json.dumps(obj))
    root = pathlib.Path(__file__).parents[2]
    contracts_deployment_dir = str(root / "contracts/build/deployments/dev")

    signal.signal(signal.SIGALRM, lambda *_unused: signal.raise_signal(signal.SIGINT))
    signal.setitimer(signal.ITIMER_REAL, 2)

    runner = CliRunner()
    result = runner.invoke(
        main,
        [
            "--keystore-file",
            str(keyfile),
            "--password",
            "",
            "--l2a-rpc-url",
            config.l2a_rpc_url,
            "--l2b-rpc-url",
            config.l2b_rpc_url,
            "--l2a-contracts-deployment-dir",
            contracts_deployment_dir,
            "--l2b-contracts-deployment-dir",
            contracts_deployment_dir,
            "--token-match-file",
            str(root / "raisync/data/tokens.example.json"),
        ],
    )
    assert result.exit_code == 0
