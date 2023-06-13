import os
import random
import sys
from pathlib import Path

from beamer.contracts import contracts_for_web3
from beamer.tests.util import create_request_id
from beamer.typing import URL, ChainId
from beamer.util import account_from_keyfile, make_web3


def main() -> None:
    assert len(sys.argv) == 5
    deployment_dir = Path(sys.argv[1])
    keystore_file = Path(sys.argv[2])
    password = sys.argv[3]
    l2_rpc = URL(sys.argv[4])

    deployer = account_from_keyfile(keystore_file, password)
    web3 = make_web3(l2_rpc, deployer)

    l2_contracts = contracts_for_web3(web3, deployment_dir)
    overriden_chain_id = os.getenv("SOURCE_CHAIN_ID")
    if overriden_chain_id is None:
        source_chain_id = ChainId(web3.eth.chain_id)
    else:
        source_chain_id = ChainId(int(overriden_chain_id))

    fill_manager = l2_contracts["FillManager"]
    token = l2_contracts["MintableToken"]

    nonce = random.randint(1, sys.maxsize)
    request_amount = 123

    request_id = create_request_id(
        source_chain_id, web3.eth.chain_id, token.address, deployer.address, request_amount, nonce
    )
    print("Request ID:", "0x%s" % request_id.hex())

    tx_hash = token.functions.mint(deployer.address, request_amount).transact()
    web3.eth.wait_for_transaction_receipt(tx_hash)

    tx_hash = token.functions.approve(fill_manager.address, request_amount).transact()
    web3.eth.wait_for_transaction_receipt(tx_hash)

    tx_hash = fill_manager.functions.addAllowedLp(deployer.address).transact()
    web3.eth.wait_for_transaction_receipt(tx_hash)

    tx_hash = fill_manager.functions.fillRequest(
        source_chain_id, token.address, deployer.address, request_amount, nonce
    ).transact()
    print("Fill tx hash:", tx_hash.hex())


if __name__ == "__main__":
    main()
