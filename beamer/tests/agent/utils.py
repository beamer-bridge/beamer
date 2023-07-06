import json
import random
import shutil
import string

import ape
from eth_typing import ChecksumAddress
from eth_utils import to_checksum_address
from hexbytes import HexBytes
from web3.constants import ADDRESS_ZERO

from beamer.tests.util import get_repo_root


def make_bytes(length: int) -> bytes:
    return bytes("".join(random.choice(string.printable) for _ in range(length)), encoding="utf-8")


def make_address() -> ChecksumAddress:
    return to_checksum_address(make_bytes(20))


def make_tx_hash() -> HexBytes:
    return HexBytes(make_bytes(32))


def generate_artifacts(artifacts_dir, contracts):
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
    artifacts_dir.mkdir()
    with artifacts_dir.joinpath("1337-ethereum.deployment.json").open("wt") as f:
        json.dump(data, f)


def generate_abi_files(abi_dir):
    root = get_repo_root()
    src = root / "contracts/.build"
    abi_dir.mkdir()
    shutil.copy(src / "RequestManager.json", abi_dir)
    shutil.copy(src / "FillManager.json", abi_dir)
