import brownie
from brownie import (
    DummyProofSubmitter,
    FillManager,
    MintableToken,
    RequestManager,
    ResolutionRegistry,
    Wei,
    accounts,
)
from brownie.network.account import Account
from brownie.network.contract import ProjectContract


def _make_request(
    request_manager: ProjectContract, token: ProjectContract, requester: Account, amount: int
) -> int:
    token.mint(requester, amount, {"from": requester})
    token.approve(request_manager.address, amount, {"from": requester})
    tx = request_manager.createRequest(
        1,
        token.address,
        token.address,
        "0x5d5640575161450A674a094730365A223B226649",
        amount,
        {"from": requester},
    )
    return tx.return_value


def main() -> None:
    accounts.add("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80")
    deployer = accounts.at("0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266")

    token = MintableToken.deploy(int(1e18), {"from": deployer})
    resolution_registry = ResolutionRegistry.deploy({"from": deployer})

    claim_stake = Wei("0.01 ether")
    claim_period = 60 * 60  # 1 hour
    challenge_period = 60 * 60 * 5  # 5 hours
    challenge_period_extension = 60 * 60  # 1 hour
    cancellation_period = 60 * 60  # 1 hour
    request_manager = RequestManager.deploy(
        claim_stake,
        claim_period,
        challenge_period,
        challenge_period_extension,
        cancellation_period,
        resolution_registry.address,
        {"from": deployer},
    )

    request_manager.updateFeeData(0, 0, {"from": deployer})

    l1_resolver_address = "0x0000000000000000000000000000000000000001"
    proof_submitter = DummyProofSubmitter.deploy({"from": deployer})
    fill_manager = FillManager.deploy(
        l1_resolver_address, proof_submitter.address, {"from": deployer}
    )

    amount = 23
    requester, claimer, challenger = accounts[:3]
    fill_manager.addAllowedLP(claimer, {"from": deployer})
    token.mint(claimer, 2 * amount, {"from": claimer})

    request_id = _make_request(request_manager, token, requester, amount)
    token.approve(fill_manager.address, amount, {"from": claimer})
    fill_manager.fillRequest(
        1, request_id, token.address, requester.address, amount, {"from": claimer}
    )
    tx = request_manager.claimRequest(request_id, {"from": claimer, "value": claim_stake})
    claim_id = tx.return_value
    brownie.chain.mine(timedelta=claim_period)
    request_manager.withdraw(claim_id, {"from": claimer})

    request_id = _make_request(request_manager, token, requester, amount)
    token.approve(fill_manager.address, amount, {"from": claimer})
    fill_manager.fillRequest(
        1, request_id, token.address, requester.address, amount, {"from": claimer}
    )
    tx = request_manager.claimRequest(request_id, {"from": claimer, "value": claim_stake})
    claim_id = tx.return_value
    request_manager.challengeClaim(claim_id, {"from": challenger, "value": claim_stake + 1})
    brownie.chain.mine(timedelta=challenge_period)
    request_manager.withdraw(claim_id, {"from": claimer})
