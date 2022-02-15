from brownie import Resolver, accounts
from .utils import RESOLVER, save_contract_address


def main() -> None:
    accounts.add("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80")
    deployer = accounts.at("0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266")

    resolver = Resolver.deploy({"from": deployer})
    save_contract_address(RESOLVER, resolver.address)
