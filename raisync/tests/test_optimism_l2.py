import eth_account
from web3 import HTTPProvider, Web3
from web3.middleware import geth_poa_middleware

_MNEMONIC = "test test test test test test test test test test test junk"

eth_account.Account.enable_unaudited_hdwallet_features()


def test_l2_send_transaction():
    acc = eth_account.Account.from_mnemonic(_MNEMONIC)

    web3 = Web3(HTTPProvider("http://127.0.0.1:8545"))
    web3.middleware_onion.inject(geth_poa_middleware, layer=0)
    assert web3.isConnected()

    txn = dict(
        nonce=web3.eth.get_transaction_count(acc.address),
        gasPrice=web3.eth.gas_price,
        gas=2200000,
        to="0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf",
        value=5000,
        chainId=420,
    )

    signed_txn = acc.sign_transaction(txn)
    txn_hash = web3.eth.send_raw_transaction(signed_txn.rawTransaction)
    receipt = web3.eth.wait_for_transaction_receipt(txn_hash)
    assert receipt.transactionHash == txn_hash
