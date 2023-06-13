from functools import update_wrapper
from typing import Any, Callable, Optional

import click
from eth_utils import decode_hex, is_checksum_address, is_hexstr, to_canonical_address

from beamer.typing import Address


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


def pass_args(f: Callable) -> Callable:
    @click.pass_context
    def new_func(ctx: Any, *args: Any, **kwargs: Any) -> Callable:
        return ctx.invoke(f, *ctx.obj.values(), *args, **kwargs)

    return update_wrapper(new_func, f)
