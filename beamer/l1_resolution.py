import subprocess
import sys

from pathlib import Path
from typing import Optional
import structlog
from hexbytes import HexBytes

from beamer.typing import URL


log = structlog.get_logger(__name__)

_RELAYER_NAMES = {"linux": "relayer-node16-linux-x64", "darwin": "relayer-node16-macos-x64"}


def get_relayer_executable() -> Optional[Path]:
    """Returns the path to the relayer executable if available, otherwise `None`"""

    bin_dir = Path(__file__).parent.joinpath("data/relayers/")
    try:
        maybe_relayer = bin_dir.joinpath(_RELAYER_NAMES[sys.platform])
    except KeyError:
        log.warning("Unsupported platform", platform=sys.platform)
        return None

    if maybe_relayer.exists():
        log.debug("Found relayer executable", relayer=maybe_relayer)
        return maybe_relayer.resolve()

    log.warning("No relayer executable found")
    return None


def run_relayer_for_tx(l1_rpc: URL, l2_rpc: URL, privkey: str, tx_hash: HexBytes) -> None:
    relayer = get_relayer_executable()

    if relayer is None:
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
