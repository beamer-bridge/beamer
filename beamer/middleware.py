from typing import Any, Callable

import lru
from web3 import Web3
from web3.types import RPCEndpoint, RPCResponse


def _result_ok(response: RPCResponse) -> bool:
    if "error" in response:
        return False
    return response.get("result") is not None


# This middleware caches responses of eth_getBlockByNumber calls. Requests with
# block number set to 'latest' will never be returned from the cache. However,
# successful responses of those calls will be stored into the cache so that
# further requests specifying a concrete block number can be satisfied from
# the cache.
def cache_get_block_by_number(
    make_request: Callable[[RPCEndpoint, Any], RPCResponse], _w3: Web3
) -> Callable[[RPCEndpoint, Any], RPCResponse]:
    cache = lru.LRU(1000)

    def middleware(method: RPCEndpoint, params: Any) -> RPCResponse:
        if method != "eth_getBlockByNumber":
            return make_request(method, params)

        if params[0] == "latest":
            response = make_request(method, params)
            if _result_ok(response):
                key = hex(response["result"].number), params[1]
                cache[key] = response
        elif params[0].startswith("0x"):
            response = cache.get(params)
            if response is None:
                response = make_request(method, params)
                if _result_ok(response):
                    cache[params] = response
        else:
            response = make_request(method, params)
        return response

    return middleware
