import functools
import threading
import time
from dataclasses import dataclass, field
from typing import Any, Callable, cast

import atomics
import atomics.base
import lru
import requests.exceptions
import structlog
from web3 import HTTPProvider, Web3
from web3.types import Middleware, RPCEndpoint, RPCResponse
from beamer.typing import ChainId


log = structlog.get_logger(__name__)

CacheMiddleware = Callable[
    [Callable[[RPCEndpoint, Any], RPCResponse], Web3, "_BlockCache"],
    Callable[[RPCEndpoint, Any], RPCResponse],
]


class _BlockCache:
    def __init__(self) -> None:
        self._block_cache = lru.LRU(1000)
        self._latest_block_number = -1
        self._latest_key: tuple[str, bool] | None = None
        self._lock = threading.Lock()

    def add_block(self, key: tuple[str, bool], data: RPCResponse) -> None:
        with self._lock:
            self._block_cache[key] = data
            block_number = int(data["result"].number, 16)
            if self._latest_block_number < block_number:
                self._latest_key = key
                self._latest_block_number = block_number

    def get_block(self, key: tuple[str, bool]) -> RPCResponse:
        return self._block_cache.get(key)

    def get_latest_block(self) -> RPCResponse | None:
        return self._block_cache.get(self._latest_key)


_BLOCK_STORAGE: dict[ChainId, _BlockCache] = {}


def _result_ok(response: RPCResponse) -> bool:
    if "error" in response:
        return False
    return response.get("result") is not None


def generate_middleware_with_cache(middleware: CacheMiddleware, chain_id: ChainId) -> Middleware:
    global _BLOCK_STORAGE

    if chain_id not in _BLOCK_STORAGE:
        _BLOCK_STORAGE[chain_id] = _BlockCache()

    cache = _BLOCK_STORAGE[chain_id]
    return cast(Middleware, functools.partial(middleware, cache=cache))


# This middleware caches responses of eth_getBlockByNumber calls. Requests with
# block number set to 'latest' will never be returned from the cache. However,
# successful responses of those calls will be stored into the cache so that
# further requests specifying a concrete block number can be satisfied from
# the cache.
def cache_get_block_by_number(
    make_request: Callable[[RPCEndpoint, Any], RPCResponse], _w3: Web3, cache: _BlockCache
) -> Callable[[RPCEndpoint, Any], RPCResponse]:
    def middleware(method: RPCEndpoint, params: Any) -> RPCResponse:
        if method != "eth_getBlockByNumber":
            return make_request(method, params)

        if params[0] == "latest":
            response = make_request(method, params)
            if _result_ok(response):
                key = response["result"].number, params[1]
                cache.add_block(key, response)
        elif params[0].startswith("0x"):
            response = cache.get_block(params)
            if response is None:
                response = make_request(method, params)
                if _result_ok(response):
                    cache.add_block(params, response)
        else:
            response = make_request(method, params)
        return response

    return middleware


# The rate limiter middleware.
#
# In cases where an RPC returns HTTP 429 (Too many requests), we need to reduce
# the rate at which we issue requests to that RPC. In order to do that, we
# define the following operating modes:
#
# 1) normal operation
# 2) rate limiting mode
# 3) tapering mode
#
# In normal operation, the RPC accepts our every request and we issue requests
# at full rate, i.e. as they come.
#
# Rate limiting mode begins when the RPC returns HTTP 429, while we are in
# normal operation. For the duration of this mode, defined by _RATE_LIMIT_PERIOD,
# we will attempt to issue requests with a reduced rate, defined by
# _RATE_LIMIT_REQUEST_DELAY, the number of seconds between each attempt.
#
# This effectively caps the request rate at 1 / _RATE_LIMIT_REQUEST_DELAY with
# the hope that the RPC will eventually notice that we slowed down and accept
# the requests. If the RPC rejects new requests even after the rate limiting
# period is over, we simply raise a RuntimeError, which will cause the agent to
# shut down, as there is nothing more that could be done.
#
# Tapering mode begins immediately after the end of rate limiting mode, with
# the idea that we ramp up to the original normal operation request rate (i.e.
# without any delays). Currently, the ramp up is implemented in the following
# way:
#
# - upon exiting the rate limiting mode, set
#   - _RateLimiterState.taper_counter to 0
#   - _RateLimiterState.taper_counter_max to the number of threads currently
#    waiting on the rate limiter lock in the _rate_limiter function
#
# - as each thread that waited on the lock gets its turn, it will notice it is
#   in the tapering mode (taper_counter_max > 0) so it will sleep for a delay of
#
#       _RATE_LIMIT_REQUEST_DELAY / 2**state.taper_counter
#
# - when taper_counter reaches taper_counter_max, the tapering mode is over and
#   we return to normal operation
#
# - if at any point during tapering mode we get rate limited by the RPC, we
#   will immediately switch back to rate limiting mode
#
# The tapering mode tries to quickly ramp up to normal request rate by
# exponentially reducing the delay time between consecutive requests.


# The rate limiter state.
#
# One instance per web3 rate limiter middleware, i.e. one instance per
# chain/RPC if there is exactly one Web3 instance per chain/RPC.
#
# Note: it is important to ensure only one Web3 instance per chain/RPC,
# otherwise, it could happen that two parallel rate limiter middleware talk to
# the same RPC, which would rate limit both middlewares.
#
# The lock protects all state fields except num_waiting_on_lock, which is an
# atomic used to keep track of threads waiting on the lock. The introduction of
# this lock means that, effectively, even in normal operation where no rate
# limiting occurs, concurrent requests may not happen as if the lock were not
# there. In other words, regardless of rate limiting, if several threads
# attempt to issue requests and arrive at the rate limiter middleware at the
# same time, they will be forced to take the lock and make the requests
# serially.
@dataclass(slots=True)
class _RateLimiterState:
    lock: threading.Lock = field(default_factory=threading.Lock)
    num_waiting_on_lock: atomics.base.AtomicUint = field(
        default_factory=lambda: atomics.atomic(width=4, atype=atomics.UINT)
    )
    rate_limit_end: None | float = None
    taper_counter: int = 0
    taper_counter_max: int = 0


# The time period during which the middleware will limit the maximum number of
# requests per second to 1 / _RATE_LIMIT_REQUEST_DELAY.
# _RATE_LIMIT_PERIOD must always be greater than _RATE_LIMIT_REQUEST_DELAY.
# It is recommended to use a small multiple of _RATE_LIMIT_REQUEST_DELAY.
_RATE_LIMIT_PERIOD = 3

# The delay between two consecutive attempts at making a request to the RPC.
# Only used during the rate limiting period.
_RATE_LIMIT_REQUEST_DELAY = 1

# The number of seconds above which the wait time on the rate limiter lock is
# considered too long. We will emit a debug log event any time a thread had
# waited on the lock longer than this. Must be greater than
# _RATE_LIMIT_REQUEST_DELAY in order to avoid spamming the log with too many
# events.
_RATE_LIMIT_LOCK_WAIT_TOO_LONG = _RATE_LIMIT_REQUEST_DELAY * 2

# A thread local object used to handle reentrancy in web3py middleware.
_RATE_LIMITER_TLD = threading.local()

# A type alias to improve readability.
_MakeRequest = Callable[[RPCEndpoint, Any], RPCResponse]


def _try_make_request(
    make_request: _MakeRequest, method: RPCEndpoint, params: Any
) -> tuple[bool, None | RPCResponse]:
    try:
        response = make_request(method, params)
    except requests.exceptions.HTTPError as exc:
        if exc.response.status_code == 429:
            return True, None
        raise exc
    return False, response


def _rate_limiter_inner(
    method: RPCEndpoint,
    params: Any,
    make_request: _MakeRequest,
    w3: Web3,
    state: _RateLimiterState,
) -> RPCResponse:
    rpc = cast(HTTPProvider, w3.provider).endpoint_uri
    while True:
        if state.rate_limit_end is not None:
            # We are in rate limiting period.
            rate_limited, response = _try_make_request(make_request, method, params)
            while rate_limited and time.time() <= state.rate_limit_end:
                time.sleep(_RATE_LIMIT_REQUEST_DELAY)
                rate_limited, response = _try_make_request(make_request, method, params)

            if rate_limited:
                # Even after _RATE_LIMIT_PERIOD, we are still being rate-limited by
                # the RPC provider so there is nothing we can really do.
                raise RuntimeError("rate limit period exceeded: %s" % rpc)

            assert response is not None

            if time.time() > state.rate_limit_end:
                # Rate limit period ended so we now enter the tapering period,
                num_waiting_on_lock = state.num_waiting_on_lock.load()
                log.debug(
                    "Exiting rate limiting mode", thread=threading.current_thread().name, rpc=rpc
                )
                state.rate_limit_end = None
                state.taper_counter = 0
                state.taper_counter_max = num_waiting_on_lock

            return response

        # We are not in rate limiting period.
        if state.taper_counter_max > 0:
            # We are in tapering period.
            request_delay = _RATE_LIMIT_REQUEST_DELAY / 2**state.taper_counter
            state.taper_counter += 1
            if state.taper_counter == state.taper_counter_max:
                # We have reached the end of tapering period.
                state.taper_counter = 0
                state.taper_counter_max = 0
                log.debug("Exiting tapering mode", thread=threading.current_thread().name, rpc=rpc)

            time.sleep(request_delay)

        # If we get rate limited by the RPC, start a new rate limiting
        # period by setting state.rate_limit_end and try sending the
        # request again after _RATE_LIMIT_REQUEST_DELAY. Otherwise,
        # simply return the response.
        rate_limited, response = _try_make_request(make_request, method, params)
        if rate_limited:
            log.debug(
                "Entering rate limiting mode", thread=threading.current_thread().name, rpc=rpc
            )
            state.rate_limit_end = time.time() + _RATE_LIMIT_PERIOD
            time.sleep(_RATE_LIMIT_REQUEST_DELAY)
        else:
            assert response is not None
            return response


def _rate_limiter(
    method: RPCEndpoint,
    params: Any,
    make_request: _MakeRequest,
    w3: Web3,
    state: _RateLimiterState,
) -> RPCResponse:
    if hasattr(_RATE_LIMITER_TLD, "entered"):
        # We already entered this function once and likely took the lock,
        # so just make a request immediately to avoid deadlocks.
        # The cause of a second entry into this function is most probably
        # an eth_chainId call made as part of our call to make_request.
        return make_request(method, params)

    _RATE_LIMITER_TLD.entered = True

    state.num_waiting_on_lock.inc()
    t = time.time()
    with state.lock:
        lock_wait_time = time.time() - t
        if lock_wait_time > _RATE_LIMIT_LOCK_WAIT_TOO_LONG:
            rpc = cast(HTTPProvider, w3.provider).endpoint_uri
            num_waiting_on_lock = state.num_waiting_on_lock.load()
            log.debug(
                "Long rate limiter lock wait time",
                thread=threading.current_thread().name,
                lock_wait_time=lock_wait_time,
                num_waiting_on_lock=num_waiting_on_lock,
                rpc=rpc,
            )

        state.num_waiting_on_lock.dec()
        try:
            # The following call may return in exactly one of these cases:
            # 1) we got a response from the RPC, during rate limiting period
            # 2) we got a response from the RPC, during tapering period
            # 3) we got a response from the RPC, during normal operation
            # 4) we got rejected by the RPC, even after rate limit period; this
            #    will result in a RuntimeError being raised, causing agent shutdown
            return _rate_limiter_inner(method, params, make_request, w3, state)
        finally:
            del _RATE_LIMITER_TLD.entered


def rate_limiter(
    make_request: _MakeRequest, w3: Web3
) -> Callable[[RPCEndpoint, Any], RPCResponse]:
    state = _RateLimiterState()
    return functools.partial(_rate_limiter, make_request=make_request, w3=w3, state=state)


def max_fee_setter(
    make_request: _MakeRequest, _w3: Web3, cache: _BlockCache
) -> Callable[[RPCEndpoint, Any], RPCResponse]:
    def middleware(method: RPCEndpoint, params: Any) -> RPCResponse:
        if method != "eth_sendTransaction":
            return make_request(method, params)
        priority_fee_response = make_request(RPCEndpoint("eth_maxPriorityFeePerGas"), [])
        if _result_ok(priority_fee_response):
            priority_fee = priority_fee_response["result"]
        else:
            return priority_fee_response

        latest_block = cache.get_latest_block()
        if latest_block is None:
            latest_block_response = make_request(
                RPCEndpoint("eth_getBlockByNumber"), ["latest", False]
            )
            if _result_ok(latest_block_response):
                latest_block = latest_block_response
            else:
                return latest_block_response
        base_fee = latest_block["result"].baseFeePerGas
        max_fee = 2 * base_fee + priority_fee
        params[0]["maxPriorityFeePerGas"] = priority_fee
        params[0]["maxFeePerGas"] = max_fee
        return make_request(method, params)

    return middleware
