from brownie import RequestManager, FillManager, DummyProofSubmitter, accounts

def main():
    l1_resolver_address = "0x0000000000000000000000000000000000000001"

    proof_submitter = DummyProofSubmitter.deploy({"from": accounts[0]})
    RequestManager.deploy({"from": accounts[0]})

    FillManager.deploy(l1_resolver_address, proof_submitter.address, {"from": accounts[0]})
