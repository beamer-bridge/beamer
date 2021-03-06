import random
import sys
import time
from pathlib import Path

from beamer.tests.util import create_request_hash
from beamer.typing import URL, ChainId
from beamer.util import account_from_keyfile, make_web3
from scripts._util import contracts_for_web3


def main() -> None:
    assert len(sys.argv) == 5
    deployment_dir = Path(sys.argv[1])
    keystore_file = Path(sys.argv[2])
    password = sys.argv[3]
    l2_rpc = URL(sys.argv[4])

    deployer = account_from_keyfile(keystore_file, password)
    web3 = make_web3(l2_rpc, deployer)

    l2_contracts = contracts_for_web3(web3, deployment_dir)
    chain_id = ChainId(web3.eth.chain_id)

    fill_manager = l2_contracts["FillManager"]

    request_id = random.randint(1, sys.maxsize)
    request_amount = 123

    token = l2_contracts["MintableToken"]
    tx_hash = token.functions.mint(deployer.address, request_amount).transact()
    web3.eth.wait_for_transaction_receipt(tx_hash)

    tx_hash = token.functions.approve(fill_manager.address, request_amount).transact()
    web3.eth.wait_for_transaction_receipt(tx_hash)

    tx_hash = fill_manager.functions.addAllowedLP(deployer.address).transact()
    web3.eth.wait_for_transaction_receipt(tx_hash)

    tx_hash = fill_manager.functions.fillRequest(
        request_id,
        chain_id,
        token.address,
        deployer.address,
        request_amount,
    ).transact()
    web3.eth.wait_for_transaction_receipt(tx_hash)

    request_hash = create_request_hash(
        request_id, chain_id, chain_id, token.address, deployer.address, request_amount
    )

    # A fill has been done, and the proof has been submitted.  As the message
    # resolver runs in the e2e setup, the resultion will be triggered
    # automatically. So we just need to wait until the fill hash ends up in the
    # resolution registry.
    resolution_registry = l2_contracts["ResolutionRegistry"]

    for _ in range(50):
        time.sleep(1)
        print("Waiting for resolution data...")
        if resolution_registry.functions.fillers(request_hash).call()[0] == deployer.address:
            break

    assert resolution_registry.functions.fillers(request_hash).call()[0] == deployer.address


if __name__ == "__main__":
    main()
