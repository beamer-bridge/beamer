import shutil
import subprocess

import structlog
from hexbytes import HexBytes

from beamer.typing import URL


log = structlog.get_logger(__name__)

_RELAYER_EXECUTABLE = "beamer-relayer"


def relayer_executable_exists() -> bool:
    """Checks if the relayer executable is in PATH, return `False` if not"""

    maybe_relayer = shutil.which(_RELAYER_EXECUTABLE)
    if maybe_relayer is not None:
        log.debug("Relayer found in PATH", relayer=maybe_relayer)
        return True

    log.warning("Relayer executable not found in PATH")
    return False


def run_relayer(l1_rpc: URL, l2_rpc: URL, privkey: str, tx_hash: HexBytes) -> None:
    subprocess.run(
        [
            _RELAYER_EXECUTABLE,
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
