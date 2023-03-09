import json
import os
import sys
import time
import ape

from beamer.tests.util import alloc_accounts, make_request


def test_sending_request_slave(contracts, token, chain_params):
    requester, target = alloc_accounts(2)
    chain_id = ape.chain.chain_id
    request_count = int(os.environ["REQUEST_COUNT"])
    for i in range(8546, 8546 + request_count):
        if i == chain_id:
            continue
        contracts.request_manager.updateChain(i, *chain_params)
        make_request(contracts.request_manager, token, requester, target, 1, target_chain_id=i)
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
