import sys
import time
from pathlib import Path

import eth_utils
from web3 import HTTPProvider, Web3

import beamer.artifacts
from beamer.contracts import ABIManager, obtain_contract
from beamer.typing import ChainId


def main() -> None:
    assert len(sys.argv) == 6
    artifacts_dir = Path(sys.argv[1])
    abi_dir = Path(sys.argv[2])
    l2_rpc = sys.argv[3]
    deployer_address = eth_utils.to_checksum_address(sys.argv[4])
    request_id = sys.argv[5]

    web3 = Web3(HTTPProvider(l2_rpc))
    abi_manager = ABIManager(abi_dir)
    deployment = beamer.artifacts.load(artifacts_dir, ChainId(web3.eth.chain_id))
    request_manager = obtain_contract(web3, abi_manager, deployment, "RequestManager")

    print("Waiting for resolution data...", flush=True, end="")
    for _ in range(60):
        time.sleep(1)
        filler = request_manager.functions.requests(request_id).call().filler
        if filler == deployer_address:
            print("ok")
            sys.exit()

    print("failure")
    sys.exit(1)


if __name__ == "__main__":
    main()
