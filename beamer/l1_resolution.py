import subprocess

from hexbytes import HexBytes

from beamer.typing import URL

RELAYER_EXECUTABLE = "beamer-relayer"


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
