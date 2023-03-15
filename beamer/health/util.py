from collections import defaultdict
from typing import TypedDict, cast

from eth_utils import to_checksum_address
from web3 import Web3
from web3.middleware import geth_poa_middleware

from beamer.agent.util import load_ERC20_abi


class TokenDetails(TypedDict):
    decimals: int
    symbol: str


def make_web3(rpc: str) -> Web3:
    web3 = Web3(Web3.HTTPProvider(rpc, request_kwargs=dict(timeout=5)))
    web3.middleware_onion.inject(geth_poa_middleware, layer=0)
    return web3


def get_token_details(token_address: str, rpc: str) -> TokenDetails:
    token_details = defaultdict(dict)  # type: ignore[var-annotated]
    contract_abi = load_ERC20_abi()
    contract_address = to_checksum_address(token_address)
    web3 = make_web3(rpc)
    contract = web3.eth.contract(address=contract_address, abi=contract_abi)
    token_details["decimals"] = contract.functions.decimals().call()
    token_details["symbol"] = contract.functions.symbol().call()
    return cast(TokenDetails, token_details)


def get_token_balance(token_address: str, wallet_address: str, rpc: str) -> int:
    contract_abi = load_ERC20_abi()
    contract_address = to_checksum_address(token_address)
    web3 = make_web3(rpc)
    contract = web3.eth.contract(address=contract_address, abi=contract_abi)
    balance = contract.functions.balanceOf(wallet_address).call()
    return balance


def get_token_amount_in_decimals(amount: int, token: TokenDetails) -> int:
    return amount * 10 ** -token["decimals"]
