import os
from pathlib import Path
from typing import Any

import click
from eth_account.account import LocalAccount
from eth_utils import to_checksum_address
from hexbytes import HexBytes
from web3 import Web3

import beamer.artifacts
from beamer.contracts import ABIManager, obtain_contract
from beamer.typing import URL, ChainId
from beamer.util import account_from_keyfile, make_web3, transact
from scripts._util import pass_args

# Topic signatures are taken from:
# https://github.com/ethereum-optimism/optimism/blob/develop/op-bindings/bindings/l1crossdomainmessenger.go
# https://github.com/ethereum-optimism/optimism/blob/develop/op-bindings/bindings/optimismportal.go
FAILED_RELAYED_MESSAGE_TOPIC = HexBytes(
    "0x99d0e048484baa1b1540b1367cb128acd7ab2946d1ed91ec10e3c85e4bf51b8f"
)
WITHDRAWAL_FINALIZED_TOPIC = HexBytes(
    "0xdb5c7652857aa163daadd670e116628fb42e869d8ac4251ef8971d9e5727df1b"
)
RELAYED_MESSAGE_TOPIC = HexBytes(
    "0x4641df4a962071e12719d8c8c8e5ac7fc4d97b927346a3d7a335b1f7517e133c"
)

# Addresses are taken from:
# https://github.com/ethereum-optimism/optimism/blob/develop/op-bindings/predeploys/dev_addresses.go
PORTAL_ADDRESS = to_checksum_address("0x6900000000000000000000000000000000000001")
MESSENGER_ADDRESS = to_checksum_address("0x6900000000000000000000000000000000000002")


@click.group("e2e-op-commands")
@click.argument(
    "keystore-file",
    type=click.Path(exists=True, dir_okay=False, readable=True),
    required=True,
)
@click.argument("password", type=str, required=True)
@click.argument("l1-rpc", type=str, required=True)
@click.pass_context
def cli(ctx: Any, keystore_file: Path, password: str, l1_rpc: str) -> None:
    account = account_from_keyfile(keystore_file, password)
    web3_l1 = make_web3(URL(l1_rpc), account)
    ctx.ensure_object(dict)
    ctx.obj["account"] = account
    ctx.obj["web3_l1"] = web3_l1


@cli.command("verify-portal-call")
@pass_args
def verify_portal_call(
    account: LocalAccount,  # pylint:disable=unused-argument
    web3_l1: Web3,
) -> None:
    portal_logs = web3_l1.eth.get_logs({"address": PORTAL_ADDRESS, "fromBlock": 0})
    messenger_logs = web3_l1.eth.get_logs({"address": MESSENGER_ADDRESS, "fromBlock": 0})
    assert any(WITHDRAWAL_FINALIZED_TOPIC in log["topics"] for log in portal_logs)
    assert any(FAILED_RELAYED_MESSAGE_TOPIC in log["topics"] for log in messenger_logs)
    print("Block Number:", web3_l1.eth.block_number)


@cli.command("set-chain-on-resolver")
@click.option(
    "--abi-dir",
    type=click.Path(exists=True, file_okay=False, dir_okay=True, path_type=Path),
    required=True,
    help="Path to the directory with contract ABIs.",
)
@click.argument(
    "artifacts-dir",
    type=Path,
    required=True,
)
@click.argument("l2-rpc", type=str)
@pass_args
def set_chain_on_resolver(
    account: LocalAccount, web3_l1: Web3, abi_dir: Path, artifacts_dir: Path, l2_rpc: URL
) -> None:
    web3 = make_web3(l2_rpc, account)
    source_chain_id = ChainId(int(os.environ["SOURCE_CHAIN_ID"]))

    op_deployment_path = artifacts_dir / "901-optimism.deployment.json"
    base_deployment_path = artifacts_dir / "base.deployment.json"

    base_deployment = beamer.artifacts.Deployment.from_file(base_deployment_path)
    op_deployment = beamer.artifacts.Deployment.from_file(op_deployment_path)

    abi_manager = ABIManager(abi_dir)
    resolver = obtain_contract(web3_l1, abi_manager, base_deployment, "Resolver")
    request_manager = obtain_contract(web3, abi_manager, op_deployment, "RequestManager")
    l1_messenger = obtain_contract(web3_l1, abi_manager, op_deployment, "OptimismL1Messenger")

    transact(
        resolver.functions.addRequestManager(
            source_chain_id, request_manager.address, l1_messenger.address
        )
    )


@cli.command("verify-messenger-call")
@pass_args
def verify_messenger_call(
    account: LocalAccount,  # pylint:disable=unused-argument
    web3_l1: Web3,
) -> None:
    block_number = int(os.environ["BLOCK_NUMBER"])
    portal_logs = web3_l1.eth.get_logs({"address": PORTAL_ADDRESS, "fromBlock": block_number})
    messenger_logs = web3_l1.eth.get_logs(
        {"address": MESSENGER_ADDRESS, "fromBlock": block_number}
    )
    assert not any(WITHDRAWAL_FINALIZED_TOPIC in log["topics"] for log in portal_logs)
    assert any(RELAYED_MESSAGE_TOPIC in log["topics"] for log in messenger_logs)


if __name__ == "__main__":
    cli()
