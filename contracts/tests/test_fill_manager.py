import brownie
from brownie import accounts, web3


def test_fill_request(fill_manager, token, deployer):
    chain_id = web3.eth.chain_id
    amount = 100
    receiver = accounts[2]

    with brownie.reverts("Ownable: caller is not the owner"):
        fill_manager.addAllowedLP(deployer, {"from": accounts[1]})

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
