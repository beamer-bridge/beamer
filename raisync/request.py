import threading
from typing import Any, Generator, Optional

from eth_typing import ChecksumAddress as Address
from statemachine import State, StateMachine

from raisync.typing import ChainId, RequestId, TokenAmount


class Request(StateMachine):
    def __init__(
        self,
        request_id: RequestId,
        source_chain_id: ChainId,
        target_chain_id: ChainId,
        target_token_address: Address,
        target_address: Address,
        amount: TokenAmount,
    ) -> None:
        super().__init__()
        self.id = request_id
        self.source_chain_id = source_chain_id
        self.target_chain_id = target_chain_id
        self.target_token_address = target_token_address
        self.target_address = target_address
        self.amount = amount

    pending = State("Pending", initial=True)
    filled = State("Filled")
    filled_unconfirmed = State("Filled-unconfirmed")

    fill = pending.to(filled) | filled_unconfirmed.to(filled)
    fill_unconfirmed = pending.to(filled_unconfirmed)


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
