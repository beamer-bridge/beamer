from typing import Optional

import click
from eth_utils import is_checksum_address, to_canonical_address

from raisync.typing import Address


def validate_address(
    _ctx: click.Context, _param: click.Parameter, value: Optional[str]
) -> Optional[Address]:
    if value is None:
        # None as default value allowed
        return None
    if not is_checksum_address(value):
        raise click.BadParameter("not an EIP-55 checksummed address")
    return to_canonical_address(value)
