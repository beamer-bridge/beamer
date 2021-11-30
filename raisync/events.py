from dataclasses import dataclass
from typing import Any

from raisync.typing import Address, ChainId, ClaimId, RequestId, Termination, TokenAmount


@dataclass(frozen=True)
class Event:
    pass


@dataclass(frozen=True)
class RequestFilled(Event):
    request_id: RequestId
    source_chain_id: ChainId
    target_token_address: Address
    amount: TokenAmount


@dataclass(frozen=True)
class RequestCreated(Event):
    request_id: RequestId
    target_chain_id: ChainId
    target_token_address: Address
    target_address: Address
    amount: TokenAmount


@dataclass(frozen=True)
class ClaimCreated(Event):
    claim_id: ClaimId
    request_id: RequestId
    claimer: Address
    termination: Termination


@dataclass(frozen=True)
class ClaimWithdrawn(Event):
    claim_id: ClaimId
    request_id: RequestId
    claim_receiver: Address


@dataclass(frozen=True)
class ClaimChallenged(Event):
    claim_id: ClaimId
    challenger: Address


@dataclass(frozen=True)
class ChallengeCountered(Event):
    claim_id: ClaimId
    leader: Address
    highest_bid: TokenAmount


def _camel_to_snake(s: str) -> str:
    return "".join("_" + c.lower() if c.isupper() else c for c in s).lstrip("_")


_EVENT_TYPES = dict(
    RequestFilled=RequestFilled,
    RequestCreated=RequestCreated,
    ClaimCreated=ClaimCreated,
    ClaimWithdrawn=ClaimWithdrawn,
    ClaimChallenged=ClaimChallenged,
    ChallengeCountered=ChallengeCountered,
)


def parse_event(data: Any) -> Event:
    kwargs = {_camel_to_snake(name): value for name, value in data.args.items()}
    assert data.event in _EVENT_TYPES
    return _EVENT_TYPES[data.event](**kwargs)
