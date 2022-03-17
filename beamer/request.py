import threading
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any, Generator, Generic, Optional, TypeVar

from eth_typing import ChecksumAddress
from eth_typing import ChecksumAddress as Address
from statemachine import State, StateMachine
from web3.types import Wei

from beamer.typing import ChainId, ClaimId, FillId, RequestId, Termination, TokenAmount


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
    ignore = pending.to(ignored)

    def on_fill(self, filler: Address, fill_id: int) -> None:
        self.filler = filler
        self.fill_id = fill_id

    def __repr__(self) -> str:
        state = self.current_state.identifier
        return f"<Request id={self.id} state={state} filler={self.filler}>"


@dataclass
class RequestData:
    # The order and types of these fields must always correspond to the order
    # and types of RequestManager's Request structure.
    sender: Address
    sourceTokenAddress: Address
    targetChainId: ChainId
    targetTokenAddress: Address
    targetAddress: Address
    amount: TokenAmount
    depositReceiver: Address
    activeClaims: int
    validUntil: int
    lpFee: TokenAmount
    beamerFee: TokenAmount

    @staticmethod
    def from_chain_data(data: Sequence) -> "RequestData":
        fields = tuple(RequestData.__annotations__)
        assert len(fields) == len(data)
        kwargs = dict(zip(fields, data))
        return RequestData(**kwargs)


@dataclass
class Claim:
    id: ClaimId
    request_id: RequestId
    fill_id: FillId
    claimer: ChecksumAddress
    claimer_stake: Wei
    challenger: ChecksumAddress
    challenger_stake: Wei
    termination: Termination
    challenge_back_off_timestamp: int
    withdrawn: bool = False


K = TypeVar("K")
V = TypeVar("V")


class Tracker(Generic[K, V]):
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._map: dict[K, V] = {}

    def add(self, key: K, value: V) -> None:
        with self._lock:
            self._map[key] = value

    def remove(self, key: K) -> None:
        with self._lock:
            del self._map[key]

    def __contains__(self, key: K) -> bool:
        with self._lock:
            return key in self._map

    def get(self, key: K) -> Optional[V]:
        return self._map.get(key)

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
