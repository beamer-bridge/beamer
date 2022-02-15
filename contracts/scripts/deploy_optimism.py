from brownie import (
    FillManager,
    OptimismProofSubmitter,
    RequestManager,
    ResolutionRegistry,
    Wei,
    accounts,
)
from .utils import (
    FILL_MANAGER,
    L1_CHAIN_ID,
    L2_CHAIN_ID,
    OPTIMISM_L2_MESSENGER_ADDRESS,
    OPTIMISM_PROOF_SUBMITTER,
    REQUEST_MANAGER,
    RESOLUTION_REGISTRY,
    RESOLVER,
    get_contract_address,
    save_contract_address,
)


def main() -> None:
    accounts.add("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80")
    deployer = accounts.at("0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266")

    l1_resolver_address = get_contract_address(RESOLVER)

    resolution_registry = ResolutionRegistry.deploy({"from": deployer})
    save_contract_address(RESOLUTION_REGISTRY, resolution_registry.address)
    resolution_registry.addCaller(
        L1_CHAIN_ID, OPTIMISM_L2_MESSENGER_ADDRESS, l1_resolver_address, {"from": deployer}
    )

    proof_submitter = OptimismProofSubmitter.deploy(
        OPTIMISM_L2_MESSENGER_ADDRESS, {"from": deployer}
    )
    save_contract_address(OPTIMISM_PROOF_SUBMITTER, proof_submitter.address)

    claim_stake = Wei("0.01 ether")
    claim_period = 60 * 60  # 1 hour
    challenge_period = 60 * 60 * 5  # 5 hours
    challenge_period_extension = 60 * 60  # 1 hour
    request_manager = RequestManager.deploy(
        claim_stake,
        claim_period,
        challenge_period,
        challenge_period_extension,
        resolution_registry.address,
        {"from": deployer},
    )
    save_contract_address(REQUEST_MANAGER, request_manager.address)

    fill_manager = FillManager.deploy(
        l1_resolver_address, proof_submitter.address, {"from": deployer}
    )
    save_contract_address(FILL_MANAGER, fill_manager.address)

    # Authorize call chain
    proof_submitter.addCaller(L2_CHAIN_ID, fill_manager.address, {"from": deployer})
