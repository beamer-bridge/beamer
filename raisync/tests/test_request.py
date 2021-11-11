import time
import brownie
from brownie import accounts


def test_request(request_manager, token, node):
    node.start()
    token.approve(request_manager.address, 1, {"from": accounts[0]})
    target_address = accounts[1]

    assert not brownie.history.of_address(request_manager.address)
    request_manager.request(1337, token.address, token.address, target_address, 1)
    txs = brownie.history.of_address(request_manager.address)
    assert len(txs) == 1
    tx = txs[0]

    # We must have 3 events, Approval, Transfer and RequestCreated.
    assert (
        len(tx.events) == 3
        and "Approval" in tx.events
        and "Transfer" in tx.events
        and "RequestCreated" in tx.events
    )

    request = tx.events["RequestCreated"]
    assert request["requestId"] == 1
    assert request["targetChainId"] == brownie.chain.id
    assert request["targetTokenAddress"] == token.address
    assert request["targetAddress"] == target_address
    assert request["amount"] == 1
    time.sleep(1)
    node.stop()
