import sys
import time
from pathlib import Path

import eth_utils
from web3 import HTTPProvider, Web3

from beamer.tests.constants import RM_R_FIELD_FILLER
from scripts._util import contracts_for_web3


def main() -> None:
    assert len(sys.argv) == 5
    deployment_dir = Path(sys.argv[1])
    l2_rpc = sys.argv[2]
    deployer_address = eth_utils.to_checksum_address(sys.argv[3])
    request_id = sys.argv[4]

    web3 = Web3(HTTPProvider(l2_rpc))
    l2_contracts = contracts_for_web3(web3, deployment_dir)
    request_manager = l2_contracts["RequestManager"]

    print("Waiting for resolution data...", flush=True, end="")
    for _ in range(60):
        time.sleep(1)
        if (
            request_manager.functions.requests(request_id).call()[RM_R_FIELD_FILLER]
            == deployer_address
        ):
            print("ok")
            sys.exit()

    print("failure")
    sys.exit(1)


if __name__ == "__main__":
    main()
