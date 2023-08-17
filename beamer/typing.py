from typing import NamedTuple, NewType

from apischema.conversions import Conversion, deserializer, serializer
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


class RequestId(_HexBytes):
    pass


class FillId(_HexBytes):
    pass


# Set up conversions so that instances of HexBytes (or its derived types)
# are serialized as 0x-prefixed strings, and can be deserialized from them.
for type_ in (HexBytes, RequestId, FillId):
    serializer(Conversion(converter=type_.hex, source=type_, target=str))
    deserializer(Conversion(converter=type_, source=str, target=type_))


ChainId = NewType("ChainId", int)
ClaimId = NewType("ClaimId", int)
TokenAmount = NewType("TokenAmount", int)
Nonce = NewType("Nonce", int)
URL = NewType("URL", str)
Termination = NewType("Termination", int)


class TransferDirection(NamedTuple):
    source: ChainId
    target: ChainId

    def __repr__(self) -> str:
        return f"{self.source} -> {self.target}"
