from time import sleep

from brownie import Contract, MintableToken, accounts

from contracts.tests.utils import create_fill_hash

from .utils import FILL_MANAGER, L2_CHAIN_ID, RESOLUTION_REGISTRY, get_contract_address


REQUEST_ID = 42
REQUEST_AMOUNT = 123


def main() -> None:
    accounts.add("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80")
    deployer = accounts.at("0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266")

    fill_manager = Contract(get_contract_address(FILL_MANAGER))

    token = MintableToken.deploy(int(1e18), {"from": deployer})
    token.approve(fill_manager.address, REQUEST_AMOUNT)
    fill_manager.addAllowedLP(deployer, {"from": deployer})
    fill_tx = fill_manager.fillRequest(
        REQUEST_ID,
        L2_CHAIN_ID,
        token.address,
        deployer.address,
        REQUEST_AMOUNT,
        {"from": deployer},
    )

    # A fill has been done, and the proof has been submitted.
    # As the message resolver runs in the e2e setup, the resultion will be triggered
    # automatically. So it is just required to compute the expected fill hash
    # and wait till the resolution is finished.
    resolution_registry = Contract(get_contract_address(RESOLUTION_REGISTRY))

    fill_hash = create_fill_hash(
        REQUEST_ID,
        L2_CHAIN_ID,
        L2_CHAIN_ID,
        token.address,
        deployer.address,
        REQUEST_AMOUNT,
        fill_tx.return_value,
    )

    for _ in range(50):
        sleep(1)
        print("Waiting for resolution data...")
        if resolution_registry.fillers(fill_hash) == deployer.address:
            break

    assert resolution_registry.fillers(fill_hash) == deployer.address
