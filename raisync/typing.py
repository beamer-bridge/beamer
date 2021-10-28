from typing import NewType
from eth_typing import (  # NOQA pylint:disable=unused-import
    Address,
    BlockNumber,
    ChecksumAddress,
    Hash32,
    HexAddress,
)

ChainId = NewType("ChainId", int)
PrivateKey = NewType("PrivateKey", bytes)
TokenAmount = NewType("TokenAmount", int)
