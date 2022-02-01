from brownie import accounts, web3
from web3.constants import ADDRESS_ZERO


def test_l1_end_to_end(fill_manager, deployer, resolution_registry, token, resolver):
    amount = 100
    request_id = 23
    filler = accounts[1]
    receiver = accounts[2]
    chain_id = web3.eth.chain_id

    fill_manager.addAllowedLP(filler, {"from": deployer})
    resolver.addRegistry(chain_id, resolution_registry.address, {"from": deployer})

    token.mint(filler, amount, {"from": filler})
    token.approve(fill_manager.address, amount, {"from": filler})

    assert resolution_registry.eligibleClaimers(request_id) == ADDRESS_ZERO

    fill_manager.fillRequest(
        chain_id, request_id, token.address, receiver, amount, {"from": filler}
    )
    assert resolution_registry.eligibleClaimers(request_id) == filler
