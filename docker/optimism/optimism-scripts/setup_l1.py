from brownie import Contract, accounts

from .utils import (
    L2_CHAIN_ID,
    OPTIMISM_PROOF_SUBMITTER,
    PROXY_OVM_L1_CROSS_DOMAIN_MESSENGER,
    RESOLUTION_REGISTRY,
    RESOLVER,
    get_contract_address,
)

messenger_address = get_contract_address(PROXY_OVM_L1_CROSS_DOMAIN_MESSENGER)


def main() -> None:
    accounts.add("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80")
    deployer = accounts.at("0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266")

    resolver = Contract(get_contract_address(RESOLVER))
    resolver.addCaller(
        L2_CHAIN_ID,
        messenger_address,
        get_contract_address(OPTIMISM_PROOF_SUBMITTER),
        {"from": deployer},
    )
    resolver.addRegistry(
        L2_CHAIN_ID,
        get_contract_address(RESOLUTION_REGISTRY),
        messenger_address,
        {"from": deployer},
    )
