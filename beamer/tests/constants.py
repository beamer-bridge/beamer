# TODO: Extend and make it smarter to get fields of structs in the contracts
from beamer.typing import FillId

FILL_ID = FillId(b"00000000000000000000000000000abc")
FILL_ID_EMPTY = FillId(bytes(bytearray(32)))

# request fields
RM_R_FIELD_LP_FEE = 9
RM_R_FIELD_PROTOCOL_FEE = 10

# claim fiels
RM_C_FIELD_TERMINATION = 6
