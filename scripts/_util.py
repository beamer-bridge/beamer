from pathlib import Path
from typing import Optional

import click
from eth_utils import decode_hex, is_checksum_address, is_hexstr, to_canonical_address
from web3 import Web3
from web3.contract import Contract

import beamer.contracts
from beamer.typing import Address, ChainId


def validate_address(
    _ctx: click.Context, _param: click.Parameter, value: Optional[str]
) -> Optional[Address]:
    if value is None:
        # None as default value allowed
        return None
    if not is_checksum_address(value):
        raise click.BadParameter("not an EIP-55 checksummed address")
    return to_canonical_address(value)


def validate_bytes(
    _ctx: click.Context, _param: click.Parameter, value: Optional[str]
) -> Optional[bytes]:
    if value is None:
        # None as default value allowed
        return None
    if not is_hexstr(value):
        raise click.BadParameter("not a hex string")

    return decode_hex(value)


def contracts_for_web3(web3: Web3, deployment_dir: Path) -> dict[str, Contract]:
    deployment_info = beamer.contracts.load_deployment_info(deployment_dir)
    chain_id = ChainId(web3.eth.chain_id)
    return beamer.contracts.make_contracts(web3, deployment_info[chain_id])
