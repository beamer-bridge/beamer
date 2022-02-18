import brownie
from contracts.tests.utils import alloc_accounts


def test_fill_request(fill_manager, token, deployer):
    chain_id = brownie.web3.eth.chain_id
    amount = 100
    filler, receiver = alloc_accounts(2)

    with brownie.reverts("Ownable: caller is not the owner"):
        fill_manager.addAllowedLP(deployer, {"from": filler})

    fill_manager.addAllowedLP(deployer, {"from": deployer})

    token.approve(fill_manager.address, amount, {"from": deployer})
    fill_manager.fillRequest(
        1,
        chain_id,
        token.address,
        receiver,
        amount,
        {"from": deployer},
    )

    with brownie.reverts("Already filled"):
        fill_manager.fillRequest(
            1,
            chain_id,
            token.address,
            receiver,
            amount,
            {"from": deployer},
        )

    fill_manager.removeAllowedLP(deployer, {"from": deployer})
    with brownie.reverts("Sender not whitelisted"):
        fill_manager.fillRequest(
            1,
            chain_id,
            token.address,
            receiver,
            amount,
            {"from": deployer},
        )
