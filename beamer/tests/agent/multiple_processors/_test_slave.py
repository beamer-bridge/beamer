import json
import os
import sys
import time
from pathlib import Path

import ape

from beamer.tests.agent.util import generate_artifacts
from beamer.tests.util import alloc_accounts, make_request


def test_sending_request_slave(contracts, token, chain_params):
    requester, target = alloc_accounts(2)
    chain_id = ape.chain.chain_id
    artifacts_dir = Path(os.environ["ARTIFACTS_DIR"])
    request_count = int(os.environ["REQUEST_COUNT"])
    first_chain_id = int(os.environ["FIRST_CHAIN_ID"])
    for i in range(first_chain_id, first_chain_id + request_count):
        if i == chain_id:
            continue
        contracts.request_manager.updateChain(i, *chain_params)
        make_request(contracts.request_manager, token, requester, target, 1, target_chain_id=i)

    generate_artifacts(artifacts_dir, contracts)
    print("Chain is ready", flush=True)

    while True:
        command = sys.stdin.readline().strip()
        if command == "get_contracts":
            contract_addresses = {
                "request_manager": contracts.request_manager.address,
                "fill_manager": contracts.fill_manager.address,
                "token": token.address,
                "l2_messenger": contracts.l2_messenger.address,
            }
            print(json.dumps(contract_addresses), flush=True)
        time.sleep(1)
