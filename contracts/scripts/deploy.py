from brownie import DummyProofSubmitter, FillManager, MintableToken, RequestManager, accounts


def main():
    accounts.add("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80")
    deployer = accounts.at("0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266")

    l1_resolver_address = "0x0000000000000000000000000000000000000001"

    MintableToken.deploy(int(1e18), {"from": deployer})

    proof_submitter = DummyProofSubmitter.deploy({"from": deployer})
    RequestManager.deploy({"from": deployer})

    FillManager.deploy(l1_resolver_address, proof_submitter.address, {"from": deployer})
