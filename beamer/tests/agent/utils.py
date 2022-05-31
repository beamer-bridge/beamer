import random
import string

from eth_typing import ChecksumAddress
from eth_utils import to_checksum_address
from hexbytes import HexBytes


def make_bytes(length: int) -> bytes:
    return bytes("".join(random.choice(string.printable) for _ in range(length)), encoding="utf-8")


def make_address() -> ChecksumAddress:
    return to_checksum_address(make_bytes(20))


def make_tx_hash() -> HexBytes:
    return HexBytes(make_bytes(32))
