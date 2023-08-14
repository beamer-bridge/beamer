import json
import shutil

import ape
from hexbytes import HexBytes
from web3.constants import ADDRESS_ZERO

from beamer.tests.util import get_repo_root, make_bytes


def make_tx_hash() -> HexBytes:
    return HexBytes(make_bytes(32))


def generate_artifacts(artifacts_dir, contracts):
    chain_id = ape.chain.chain_id
    data = {
        "deployer": ADDRESS_ZERO,
        "base": {"chain_id": chain_id},
        "chain": {
            "chain_id": chain_id,
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
    artifacts_dir.mkdir(exist_ok=True)
    path = artifacts_dir / f"{chain_id}-ethereum.deployment.json"
    with path.open("wt") as f:
        json.dump(data, f)


def generate_abi_files(abi_dir):
    root = get_repo_root()
    src = root / "contracts/.build"
    abi_dir.mkdir(exist_ok=True)
    shutil.copy(src / "RequestManager.json", abi_dir)
    shutil.copy(src / "FillManager.json", abi_dir)
