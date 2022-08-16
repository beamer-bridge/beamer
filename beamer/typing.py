from typing import NewType
from eth_typing import (  # NOQA pylint:disable=unused-import
    Address,
    BlockNumber,
    ChecksumAddress,
    Hash32,
    HexAddress,
)

from hexbytes import HexBytes


class _HexBytes(HexBytes):
    def __repr__(self) -> str:
        return "%s(%r)" % (type(self).__name__, self.hex())


class FillId(_HexBytes):
    pass


class FillHash(_HexBytes):
    pass


class RequestHash(_HexBytes):
    pass


ChainId = NewType("ChainId", int)
ClaimId = NewType("ClaimId", int)
RequestId = NewType("RequestId", int)
PrivateKey = NewType("PrivateKey", bytes)
TokenAmount = NewType("TokenAmount", int)
URL = NewType("URL", str)
Termination = NewType("Termination", int)
