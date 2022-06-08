import json
import random
import sys
import time
from pathlib import Path
from typing import cast

from eth_account import Account
from eth_account.signers.local import LocalAccount
from web3 import HTTPProvider, Web3
from web3.gas_strategies.rpc import rpc_gas_price_strategy
from web3.middleware import construct_sign_and_send_raw_middleware, geth_poa_middleware

import beamer.contracts
from beamer.tests.util import create_request_hash
from beamer.typing import ChainId


def web3_for_rpc(rpc: str, account: LocalAccount) -> Web3:
    web3 = Web3(HTTPProvider(rpc))

    web3.eth.set_gas_price_strategy(rpc_gas_price_strategy)
    web3.middleware_onion.inject(geth_poa_middleware, layer=0)
    web3.middleware_onion.add(construct_sign_and_send_raw_middleware(account))
    web3.eth.default_account = account.address

    return web3


def account_from_keyfile(keyfile: Path, password: str) -> LocalAccount:
    with open(keyfile, "rt") as fp:
        privkey = Account.decrypt(json.load(fp), password)
    return cast(LocalAccount, Account.from_key(privkey))


def main() -> None:
    assert len(sys.argv) == 4
    deployment_dir = Path(sys.argv[1])
    keystore_file = Path(sys.argv[2])
    l2_rpc = sys.argv[3]

    deployer = account_from_keyfile(keystore_file, "")
    web3 = web3_for_rpc(l2_rpc, deployer)
    deployment_info = beamer.contracts.load_deployment_info(deployment_dir)

    chain_id = ChainId(web3.eth.chain_id)
    l2_contracts = beamer.contracts.make_contracts(web3, deployment_info[chain_id])

    fill_manager = l2_contracts["FillManager"]

    request_id = random.randint(1, sys.maxsize)
    request_amount = 123

    token = l2_contracts["MintableToken"]
    token.functions.mint(deployer.address, request_amount).transact()

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
