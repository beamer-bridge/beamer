from typing import Optional

from eth_typing import ChecksumAddress as Address
from statemachine import State, StateMachine

from beamer.typing import ChainId, FillId, RequestId, TokenAmount


class Request(StateMachine):
    def __init__(
        self,
        request_id: RequestId,
        source_chain_id: ChainId,
        target_chain_id: ChainId,
        source_token_address: Address,
        target_token_address: Address,
        target_address: Address,
        amount: TokenAmount,
        valid_until: int,
    ) -> None:
        super().__init__()
        self.id = request_id
        self.source_chain_id = source_chain_id
        self.target_chain_id = target_chain_id
        self.source_token_address = source_token_address
        self.target_token_address = target_token_address
        self.target_address = target_address
        self.amount = amount
        self.valid_until = valid_until
        self.filler: Optional[Address] = None
        self.fill_id: Optional[int] = None

    pending = State("Pending", initial=True)
    filled = State("Filled")
    claimed = State("Claimed")
    withdrawn = State("Withdrawn")
    ignored = State("Ignored")

    fill = pending.to(filled) | filled.to(filled) | ignored.to(filled)
    try_to_fill = pending.to(filled)
    try_to_claim = filled.to(claimed)
    withdraw = claimed.to(withdrawn) | filled.to(withdrawn) | ignored.to(withdrawn)
    ignore = pending.to(ignored) | filled.to(ignored)

    def on_fill(self, filler: Address, fill_id: FillId) -> None:
        self.filler = filler
        self.fill_id = fill_id

    def __repr__(self) -> str:
        state = self.current_state.identifier
        return f"<Request id={self.id} state={state} filler={self.filler}>"
