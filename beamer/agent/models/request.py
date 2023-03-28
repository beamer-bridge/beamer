from typing import Optional

import structlog
from eth_typing import ChecksumAddress
from hexbytes import HexBytes
from statemachine import State, StateMachine
from web3.types import Timestamp

from beamer.agent.typing import ChainId, FillId, Nonce, RequestId, TokenAmount


class Request(StateMachine):
    def __init__(
        self,
        request_id: RequestId,
        source_chain_id: ChainId,
        target_chain_id: ChainId,
        source_token_address: ChecksumAddress,
        target_token_address: ChecksumAddress,
        target_address: ChecksumAddress,
        amount: TokenAmount,
        nonce: Nonce,
        valid_until: int,
    ) -> None:
        self._log = structlog.get_logger(type(self).__name__)
        self.id = request_id
        self.source_chain_id = source_chain_id
        self.target_chain_id = target_chain_id
        self.source_token_address = source_token_address
        self.target_token_address = target_token_address
        self.target_address = target_address
        self.amount = amount
        self.nonce = nonce
        self.valid_until = valid_until
        self.filler: Optional[ChecksumAddress] = None
        self.fill_tx: Optional[HexBytes] = None
        self.fill_timestamp: Optional[Timestamp] = None
        self.fill_id: Optional[FillId] = None
        self.invalid_fill_ids: dict[FillId, tuple[HexBytes, int]] = {}
        self.l1_resolution_filler: Optional[ChecksumAddress] = None
        self.l1_resolution_fill_id: Optional[FillId] = None
        self.l1_resolution_invalid_fill_ids: set[FillId] = set()
        super().__init__()

    pending = State("Pending", initial=True)
    filled = State("Filled")
    claimed = State("Claimed")
    l1_resolved = State("L1Resolved")
    withdrawn = State("Withdrawn")
    ignored = State("Ignored")

    fill = pending.to(filled) | filled.to(filled) | ignored.to(filled) | claimed.to(claimed)
    try_to_fill = pending.to(filled)
    try_to_claim = filled.to(claimed)
    l1_resolve = (
        filled.to(l1_resolved)
        | claimed.to(l1_resolved)
        | l1_resolved.to(l1_resolved)
        | withdrawn.to(withdrawn)
        | ignored.to(ignored)
    )
    withdraw = (
        claimed.to(withdrawn)
        | filled.to(withdrawn)
        | l1_resolved.to(withdrawn)
        | ignored.to(withdrawn)
    )
    ignore = pending.to(ignored) | filled.to(ignored)

    def on_enter_state(self) -> None:
        self._log.debug("Request changed state", request=self)

    def on_fill(
        self,
        filler: ChecksumAddress,
        fill_tx: HexBytes,
        fill_id: FillId,
        fill_timestamp: Timestamp,
    ) -> None:
        self.filler = filler
        self.fill_tx = fill_tx
        self.fill_id = fill_id
        self.fill_timestamp = fill_timestamp

    def on_l1_resolve(
        self, l1_filler: Optional[ChecksumAddress] = None, l1_fill_id: Optional[FillId] = None
    ) -> None:
        self.l1_resolution_filler = l1_filler
        self.l1_resolution_fill_id = l1_fill_id

    def __repr__(self) -> str:
        state = self.current_state.id
        return f"<Request id={self.id!r} state={state} filler={self.filler}>"
