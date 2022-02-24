import threading
from collections.abc import Iterator
from typing import Any, Generator, Optional

from eth_typing import ChecksumAddress as Address
from statemachine import State, StateMachine

from raisync.events import ClaimMade
from raisync.typing import ChainId, ClaimId, RequestId, TokenAmount


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
    ) -> None:
        super().__init__()
        self.id = request_id
        self.source_chain_id = source_chain_id
        self.target_chain_id = target_chain_id
        self.source_token_address = source_token_address
        self.target_token_address = target_token_address
        self.target_address = target_address
        self.amount = amount
        self._claims: dict[ClaimId, ClaimMade] = {}
        self.filler: Optional[Address] = None
        self.fill_id: Optional[int] = None

    pending = State("Pending", initial=True)
    filled = State("Filled")
    filled_unconfirmed = State("Filled-unconfirmed")
    claimed = State("Claimed")
    claimed_unconfirmed = State("Claimed-unconfirmed")
    withdrawn = State("Withdrawn")
    unfillable = State("Unfillable")

    fill = pending.to(filled) | filled_unconfirmed.to(filled)
    fill_unconfirmed = pending.to(filled_unconfirmed)
    claim = (
        pending.to(claimed)
        | filled.to(claimed)
        | claimed_unconfirmed.to(claimed)
        | claimed.to(claimed)
    )
    claim_unconfirmed = filled.to(claimed_unconfirmed)
    withdraw = claimed.to(withdrawn)
    ignore = pending.to(unfillable)

    def on_fill(self, filler: Address, fill_id: int) -> None:
        self.filler = filler
        self.fill_id = fill_id

    def on_claim(self, event: ClaimMade) -> None:
        assert event.request_id == self.id, "got claim for another request"
        self._claims[event.claim_id] = event

    def iter_claims(self) -> Iterator[ClaimMade]:
        return iter(self._claims.values())

    def __repr__(self) -> str:
        claims = getattr(self, "_claims", [])
        state = self.current_state.identifier
        return f"<Request id={self.id} state={state} filler={self.filler} claims={claims}>"


class RequestTracker:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._map: dict[RequestId, Request] = {}

    def add(self, request: Request) -> None:
        with self._lock:
            self._map[request.id] = request

    def remove(self, request_id: RequestId) -> None:
        with self._lock:
            del self._map[request_id]

    def __contains__(self, request_id: RequestId) -> bool:
        with self._lock:
            return request_id in self._map

    def get(self, request_id: RequestId) -> Optional[Request]:
        return self._map.get(request_id)

    def __iter__(self) -> Any:
        def locked_iter() -> Generator:
            with self._lock:
                it = iter(self._map.values())
                while True:
                    try:
                        yield next(it)
                    except StopIteration:
                        return

        return locked_iter()
