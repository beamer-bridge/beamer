import subprocess
import sys

from pathlib import Path
import structlog
from hexbytes import HexBytes

from beamer.typing import URL


log = structlog.get_logger(__name__)

_RELAYER_NAMES = {"linux": "relayer-node16-linux-x64", "darwin": "relayer-node16-macos-x64"}


def get_relayer_executable() -> Path:
    """Returns the path to the relayer executable.
    Callers must check that the executable exists before using it."""
    name = _RELAYER_NAMES.get(sys.platform)
    if name is None:
        raise RuntimeError(f"Unsupported platform: {sys.platform}")

    path = Path(__file__).parent.joinpath(f"data/relayers/{name}")
    return path.resolve()


def run_relayer_for_tx(l1_rpc: URL, l2_rpc: URL, privkey: str, tx_hash: HexBytes) -> None:
    relayer = get_relayer_executable()

    if not relayer.exists():
        log.error("No relayer found")
        sys.exit(1)

    subprocess.run(
        [
            str(relayer),
            "--l1rpcprovider",
            l1_rpc,
            "--l2rpcprovider",
            l2_rpc,
            "--l1wallet",
            privkey,
            "--froml2transactionhash",
            tx_hash,
        ],
        capture_output=True,
        encoding="utf-8",
        check=True,  # check throws an error right away
    )
