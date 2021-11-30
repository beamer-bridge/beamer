from typing import NewType
from eth_typing import (  # NOQA pylint:disable=unused-import
    Address,
    BlockNumber,
    ChecksumAddress,
    Hash32,
    HexAddress,
)

ChainId = NewType("ChainId", int)
ClaimId = NewType("ClaimId", int)
RequestId = NewType("RequestId", int)
PrivateKey = NewType("PrivateKey", bytes)
TokenAmount = NewType("TokenAmount", int)
URL = NewType("URL", str)
Termination = NewType("Termination", int)
