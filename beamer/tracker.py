import threading
from typing import Any, Generator, Generic, Optional, TypeVar

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

    def __len__(self) -> int:
        with self._lock:
            return len(self._map)
