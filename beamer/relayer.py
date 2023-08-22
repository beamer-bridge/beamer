import contextlib
import json
import re
import subprocess
import sys
import tempfile
import uuid
from pathlib import Path
from typing import Generator

import structlog
from eth_account.account import LocalAccount
from hexbytes import HexBytes

from beamer.typing import URL

log = structlog.get_logger(__name__)

_RELAYER_NAMES = {"linux": "relayer-node18-linux-x64", "darwin": "relayer-node18-macos-x64"}


def get_relayer_executable() -> Path:
    """Returns the path to the relayer executable.
    Callers must check that the executable exists before using it."""
    name = _RELAYER_NAMES.get(sys.platform)
    if name is None:
        raise RuntimeError(f"Unsupported platform: {sys.platform}")
    path = Path(__file__).parent.joinpath(f"data/relayers/{name}")
    return path.resolve()


@contextlib.contextmanager
def _account_store(account: LocalAccount) -> Generator[tuple[str, str], None, None]:
    password = uuid.uuid4().hex
    data = account.encrypt(password)
    with tempfile.TemporaryDirectory() as tmp_path:
        tmp_file = Path(tmp_path) / "keystore.json"
        with open(tmp_file, "w") as f:
            json.dump(data, f)
        yield str(tmp_file), password


def run_relayer_for_tx(
    l1_rpc: URL,
    l2_relay_from_rpc_url: URL,
    l2_relay_to_rpc_url: URL,
    account: LocalAccount,
    tx_hash: HexBytes,
    prove_tx: bool = False,
) -> str | None:
    relayer = get_relayer_executable()

    if not relayer.exists():
        log.error("No relayer found")
        sys.exit(1)

    with _account_store(account) as (account_path, password):
        command_args = [
            str(relayer),
            "relay" if not prove_tx else "prove-op-message",
            "--l1-rpc-url",
            l1_rpc,
            "--keystore-file",
            account_path,
            "--password",
            password,
            "--l2-transaction-hash",
            tx_hash.hex(),
        ]

        if prove_tx:
            command_args.extend(["--l2-rpc-url", l2_relay_from_rpc_url])
        else:
            command_args.extend(
                [
                    "--l2-relay-to-rpc-url",
                    l2_relay_to_rpc_url,
                    "--l2-relay-from-rpc-url",
                    l2_relay_from_rpc_url,
                ]
            )
        try:
            result = subprocess.run(
                command_args,
                capture_output=True,
                encoding="utf-8",
                check=True,  # check throws an error right away
            )
        except subprocess.CalledProcessError as ex:
            relayer_args = ex.args[1]
            idx = relayer_args.index("--password")
            relayer_args[idx + 1] = "<REDACTED>"
            raise ex
        if prove_tx:
            timestamp_match = re.search(r"Proof timestamp: (\d+)", result.stdout)
            if timestamp_match is not None:
                return timestamp_match.group(1)
            raise RuntimeError("relayer failed to provide proof timestamp")

    return None
