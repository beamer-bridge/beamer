# TODO: Extend and make it smarter to get fields of structs in the contracts
from beamer.typing import FillId

FILL_ID = FillId("abc".zfill(64))
FILL_ID_EMPTY = FillId(bytes(32))

# request fields
RM_R_FIELD_VALID_UNTIL = 4
RM_R_FIELD_LP_FEE = 5
RM_R_FIELD_PROTOCOL_FEE = 6
RM_R_FIELD_FILLER = 9
RM_R_FIELD_FILL_ID = 10

# claim fiels
RM_C_FIELD_TERMINATION = 6
