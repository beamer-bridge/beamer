import time
from dataclasses import dataclass
from itertools import pairwise
from typing import Iterable, Optional

import requests
import structlog
from eth_abi.codec import ABICodec
from eth_utils.abi import event_abi_to_log_topic
from hexbytes import HexBytes
from requests.exceptions import HTTPError, ReadTimeout, RequestException
from web3 import HTTPProvider, Web3
from web3.constants import ADDRESS_ZERO
from web3.contract import Contract
from web3.contract.contract import get_event_data
from web3.types import ABIEvent, BlockData, ChecksumAddress, FilterParams, LogReceipt, Wei

from beamer.typing import (
    BlockNumber,
    ChainId,
    ClaimId,
    FillId,
    Nonce,
    RequestId,
    Termination,
    TokenAmount,
)

_BLOCK_UPDATED_FORMAT = "<LatestBlockUpdatedEvent event_chain_id=%s block_number=%s hash=%s>"


@dataclass(frozen=True)
class Event:
    event_chain_id: ChainId
    event_address: ChecksumAddress


@dataclass(frozen=True)
class SourceChainEvent(Event):
    pass


@dataclass(frozen=True)
class TargetChainEvent(Event):
    pass


@dataclass(frozen=True)
class LatestBlockUpdatedEvent(Event):
    block_data: BlockData

    def __init__(self, event_chain_id: ChainId, block_data: BlockData) -> None:
        # We need to set these directly via __dict__ since the class is frozen.
        self.__dict__["event_chain_id"] = event_chain_id
        self.__dict__["event_address"] = ADDRESS_ZERO
        self.__dict__["block_data"] = block_data

    def __repr__(self) -> str:
        chain_id = self.event_chain_id
        number = self.block_data["number"]
        hash_ = self.block_data["hash"].hex()
        return _BLOCK_UPDATED_FORMAT % (chain_id, number, hash_)


@dataclass(frozen=True)
class TxEvent(Event):
    block_number: BlockNumber
    tx_hash: HexBytes


@dataclass(frozen=True)
class ChainUpdated(TxEvent, SourceChainEvent):
    chain_id: ChainId
    finality_period: int
    target_weight_ppm: int
    transfer_cost: int


@dataclass(frozen=True)
class FeesUpdated(TxEvent, SourceChainEvent):
    min_fee_ppm: int
    lp_fee_ppm: int
    protocol_fee_ppm: int


@dataclass(frozen=True)
class TokenUpdated(TxEvent, SourceChainEvent):
    token_address: ChecksumAddress
    transfer_limit: int
    eth_in_token: int


@dataclass(frozen=True)
class LpAdded(TxEvent, SourceChainEvent, TargetChainEvent):
    lp: ChecksumAddress


@dataclass(frozen=True)
class LpRemoved(TxEvent, SourceChainEvent, TargetChainEvent):
    lp: ChecksumAddress


@dataclass(frozen=True)
class RequestEvent(TxEvent):
    request_id: RequestId


@dataclass(frozen=True)
class RequestCreated(RequestEvent, SourceChainEvent):
    target_chain_id: ChainId
    source_token_address: ChecksumAddress
    target_token_address: ChecksumAddress
    source_address: ChecksumAddress
    target_address: ChecksumAddress
    amount: TokenAmount
    nonce: Nonce
    valid_until: Termination
    lp_fee: TokenAmount
    protocol_fee: TokenAmount


@dataclass(frozen=True)
class RequestFilled(RequestEvent, TargetChainEvent):
    fill_id: FillId
    source_chain_id: ChainId
    target_token_address: ChecksumAddress
    filler: ChecksumAddress
    amount: TokenAmount


@dataclass(frozen=True)
class DepositWithdrawn(RequestEvent, SourceChainEvent):
    receiver: ChecksumAddress


@dataclass(frozen=True)
class ClaimEvent(TxEvent):
    claim_id: ClaimId


@dataclass(frozen=True)
class ClaimMade(ClaimEvent, SourceChainEvent):
    request_id: RequestId
    fill_id: FillId
    claimer: ChecksumAddress
    claimer_stake: Wei
    last_challenger: ChecksumAddress
    challenger_stake_total: Wei
    termination: Termination


@dataclass(frozen=True)
class ClaimStakeWithdrawn(ClaimEvent, SourceChainEvent):
    request_id: RequestId
    stake_recipient: ChecksumAddress


@dataclass(frozen=True)
class RequestResolved(TxEvent, SourceChainEvent):
    request_id: RequestId
    filler: ChecksumAddress
    fill_id: FillId


@dataclass(frozen=True)
class FillInvalidatedResolved(TxEvent, SourceChainEvent):
    request_id: RequestId
    fill_id: FillId


@dataclass(frozen=True)
class FillInvalidated(TxEvent, TargetChainEvent):
    request_id: RequestId
    fill_id: FillId


def _camel_to_snake(s: str) -> str:
    snake = "".join(
        "%c_" % current if current.islower() and next.isupper() else current.lower()
        for current, next in pairwise(s)
    )
    # The last character isn't included in snake due to how pairwise() works,
    # so add it manually.
    return snake.lstrip("_") + s[-1].lower()


_EVENT_TYPES = dict(
    RequestCreated=RequestCreated,
    RequestFilled=RequestFilled,
    DepositWithdrawn=DepositWithdrawn,
    ClaimMade=ClaimMade,
    ClaimStakeWithdrawn=ClaimStakeWithdrawn,
    RequestResolved=RequestResolved,
    FillInvalidatedResolved=FillInvalidatedResolved,
    FillInvalidated=FillInvalidated,
    ChainUpdated=ChainUpdated,
    FeesUpdated=FeesUpdated,
    TokenUpdated=TokenUpdated,
    LpAdded=LpAdded,
    LpRemoved=LpRemoved,
)


def _make_topics_abi_mapping_for_contracts(contracts: Iterable[Contract]) -> dict[bytes, ABIEvent]:
    result = {}
    for contract in contracts:
        result.update(_make_topics_to_abi(contract))

    return result


def _make_topics_to_abi(contract: Contract) -> dict[bytes, ABIEvent]:
    event_abis = {}
    for abi in contract.abi:
        if abi["type"] == "event":
            event_abis[event_abi_to_log_topic(abi)] = abi  # type: ignore
    return event_abis


def _convert_bytes(kwargs: dict) -> None:
    for name, type_ in (
        ("fill_id", FillId),
        ("request_id", RequestId),
    ):
        value = kwargs.get(name)
        if value is not None:
            kwargs[name] = type_(value)


def _decode_event(
    codec: ABICodec, log_entry: LogReceipt, chain_id: ChainId, event_abis: dict[bytes, ABIEvent]
) -> Optional[Event]:
    topic = log_entry["topics"][0]
    event_abi = event_abis[topic]
    data = get_event_data(abi_codec=codec, event_abi=event_abi, log_entry=log_entry)
    if data.event in _EVENT_TYPES:
        kwargs = {_camel_to_snake(name): value for name, value in data.args.items()}
        kwargs["event_chain_id"] = chain_id
        kwargs["event_address"] = log_entry["address"]
        kwargs["block_number"] = log_entry["blockNumber"]
        kwargs["tx_hash"] = log_entry["transactionHash"]
        _convert_bytes(kwargs)
        return _EVENT_TYPES[data.event](**kwargs)
    return None


def _decode_events(
    logs: list[LogReceipt], codec: ABICodec, chain_id: ChainId, event_abis: dict[bytes, ABIEvent]
) -> list[Event]:
    events = []
    for entry in logs:
        event = _decode_event(codec, entry, chain_id, event_abis)
        if event is not None:
            events.append(event)
    return events


class EventFetcher:
    _DEFAULT_BLOCKS = 1_000
    _MIN_BLOCKS = 2
    _MAX_BLOCKS = 100_000
    _ETH_GET_LOGS_THRESHOLD_FAST = 2
    _ETH_GET_LOGS_THRESHOLD_SLOW = 5

    def __init__(
        self,
        web3: Web3,
        contracts: tuple[Contract, ...],
        start_block: BlockNumber,
        confirmation_blocks: int,
    ):
        self._web3 = web3
        self._chain_id = ChainId(web3.eth.chain_id)
        self._contract_addresses = [c.address for c in contracts]
        self._next_block_number = start_block
        self._blocks_to_fetch = EventFetcher._DEFAULT_BLOCKS
        self._event_abis = _make_topics_abi_mapping_for_contracts(contracts)
        self._confirmation_blocks = confirmation_blocks
        self._log = structlog.get_logger(type(self).__name__).bind(chain_id=self._chain_id)

        for contract in contracts:
            assert self._chain_id == contract.w3.eth.chain_id, f"Chain id mismatch for {contract}"

    @property
    def synced_block(self) -> BlockNumber:
        return BlockNumber(self._next_block_number - 1)

    def _fetch_range(
        self, from_block: BlockNumber, to_block: BlockNumber
    ) -> Optional[list[Event]]:
        """Returns a list of events that happened in the period [from_block, to_block],
        or None if a timeout occurs."""
        self._log.debug(
            "Fetching events",
            contracts=self._contract_addresses,
            from_block=from_block,
            to_block=to_block,
        )

        before_query = time.monotonic()
        params: FilterParams = dict(
            fromBlock=from_block, toBlock=to_block, address=self._contract_addresses
        )
        try:
            logs = self._web3.eth.get_logs(params)

        # Boba limits the range to 5000 blocks
        # 'ValueError: {'code': -32000, 'message': 'exceed maximum block range: 5000'}'
        # Some RPC providers return HTTP 413 (Request Entity Too Large) when
        # the range is too big.
        except (ReadTimeout, ValueError, HTTPError) as exc:
            if isinstance(exc, HTTPError) and exc.response.status_code != 413:
                raise exc

            old = self._blocks_to_fetch
            self._blocks_to_fetch = max(EventFetcher._MIN_BLOCKS, old // 5)
            self._log.debug(
                "Failed to get events, reducing number of blocks",
                old=old,
                new=self._blocks_to_fetch,
                exc=exc,
            )
            return None

        except requests.exceptions.ConnectionError as exc:
            assert isinstance(self._web3.provider, HTTPProvider)
            url = self._web3.provider.endpoint_uri
            self._log.error("Connection error", url=url, exc=exc)
            # Propagate the exception upwards, so we don't make further attempts.
            raise exc

        else:
            after_query = time.monotonic()
            duration = after_query - before_query
            if duration < EventFetcher._ETH_GET_LOGS_THRESHOLD_FAST:
                self._blocks_to_fetch = min(EventFetcher._MAX_BLOCKS, self._blocks_to_fetch * 2)
            elif duration > EventFetcher._ETH_GET_LOGS_THRESHOLD_SLOW:
                self._blocks_to_fetch = max(EventFetcher._MIN_BLOCKS, self._blocks_to_fetch // 2)

            return _decode_events(
                logs=logs,
                codec=self._web3.codec,
                chain_id=self._chain_id,
                event_abis=self._event_abis,
            )

    def fetch(self) -> list[Event]:
        try:
            block_data = self._web3.eth.get_block("latest")
        except requests.exceptions.ConnectionError:
            raise
        except RequestException:
            return []

        block_number = BlockNumber(block_data["number"] - self._confirmation_blocks)

        if block_number < self._next_block_number:
            return []

        result = []
        from_block = self._next_block_number

        while from_block <= block_number:
            to_block = min(block_number, BlockNumber(from_block + self._blocks_to_fetch))
            events = self._fetch_range(from_block, to_block)
            if events is not None:
                result.extend(events)
                from_block = BlockNumber(to_block + 1)

        self._next_block_number = from_block
        try:
            # Block number needs to be decremented here, because it is already incremented above
            block_data = self._web3.eth.get_block(from_block - 1)
        except requests.exceptions.ConnectionError:
            raise
        except RequestException:
            return result
        else:
            result.append(
                LatestBlockUpdatedEvent(
                    event_chain_id=self._chain_id,
                    block_data=block_data,
                )
            )
        return result
