import json
from typing import Any, cast

import click
import structlog
from _util import validate_address
from eth_account import Account
from eth_account.signers.local import LocalAccount
from eth_typing import Address
from web3 import HTTPProvider, Web3

log = structlog.get_logger(__name__)


def _load_contract_info(path: str) -> tuple[str, Any]:
    with open(path, "rt") as fp:
        info = json.load(fp)
    return info["deployment"]["address"], info["abi"]


def _account_from_keyfile(keyfile: str, password: str) -> LocalAccount:
    with open(keyfile, "rt") as fp:
        privkey = Account.decrypt(json.load(fp), password)
    return cast(LocalAccount, Account.from_key(privkey))


@click.command()
@click.option(
    "--contract-deployment",
    type=str,
    required=True,
    metavar="FILE",
    help="The JSON file that stores the contract deployment information.",
)
@click.option(
    "--recipient",
    type=str,
    required=True,
    metavar="ADDRESS",
    callback=validate_address,
    help="Address that should receive the minted tokens.",
)
@click.option(
    "--keystore-file",
    type=str,
    required=True,
    metavar="FILE",
    help="The file that stores the key for the account to be used.",
)
@click.option(
    "--password", type=str, required=True, help="The password needed to unlock the account."
)
@click.option(
    "--amount", type=int, default=100, help="Amount of tokens to mint.", show_default=True
)
@click.option("--eth-rpc", default="http://localhost:8545", type=str, help="Ethereum node RPC URL")
def main(
    contract_deployment: str,
    recipient: str,
    keystore_file: str,
    password: str,
    amount: int,
    eth_rpc: str,
) -> None:
    account = _account_from_keyfile(keystore_file, password)
    address, abi = _load_contract_info(contract_deployment)

    web3 = Web3(HTTPProvider(eth_rpc))
    web3.eth.default_account = account.address

    token = web3.eth.contract(abi=abi, address=cast(Address, address))
    decimals = token.functions.decimals().call()
    token.functions.mint(recipient, amount * 10 ** decimals).transact()


if __name__ == "__main__":
    main()
