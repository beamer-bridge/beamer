from brownie import (
    FillManager,
    MintableToken,
    OptimismProofSubmitter,
    RequestManager,
    ResolutionRegistry,
    Resolver,
    TestCrossDomainMessenger,
    ProofSubmitterProxy,
    Wei,
    accounts,
    web3,
)


def main() -> None:
    accounts.add("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80")
    deployer = accounts.at("0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266")

    messenger = TestCrossDomainMessenger.deploy({"from": deployer})
    resolver = Resolver.deploy({"from": deployer})
    resolution_registry = ResolutionRegistry.deploy({"from": deployer})

    MintableToken.deploy(int(1e18), {"from": deployer})

    claim_stake = Wei("0.01 ether")
    claim_period = 60 * 60  # 1 hour
    challenge_period = 60 * 60 * 5  # 5 hours
    challenge_period_extension = 60 * 60  # 1 hour
    RequestManager.deploy(
        claim_stake,
        claim_period,
        challenge_period,
        challenge_period_extension,
        resolution_registry.address,
        {"from": deployer},
    )

    proof_submitter = OptimismProofSubmitter.deploy(messenger.address, {"from": deployer})
    proof_submitter_proxy = ProofSubmitterProxy.deploy(
        proof_submitter.address, b"", {"from": deployer}
    )
    f = FillManager.deploy(resolver.address, proof_submitter_proxy.address, {"from": deployer})
    f.addAllowedLP(deployer.address, {"from": deployer})

    resolver.addRegistry(
        web3.eth.chain_id, resolution_registry.address, messenger.address, {"from": deployer}
    )
