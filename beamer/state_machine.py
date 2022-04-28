import os
import time
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

import structlog
from eth_typing import ChecksumAddress
from hexbytes import HexBytes
from statemachine.exceptions import TransitionNotAllowed
from web3.constants import ADDRESS_ZERO
from web3.contract import Contract
from web3.types import BlockData

import beamer.metrics
from beamer.events import (
    ClaimMade,
    ClaimWithdrawn,
    DepositWithdrawn,
    Event,
    FillHashInvalidated,
    InitiateL1ResolutionEvent,
    LatestBlockUpdatedEvent,
    RequestCreated,
    RequestFilled,
    RequestResolved,
)
from beamer.models.claim import Claim
from beamer.models.request import Request
from beamer.tracker import Tracker
from beamer.typing import ChainId, ClaimId, RequestId
from beamer.util import TokenMatchChecker

log = structlog.get_logger(__name__)


@dataclass
class Context:
    requests: Tracker[RequestId, Request]
    claims: Tracker[ClaimId, Claim]
    request_manager: Contract
    fill_manager: Contract
    match_checker: TokenMatchChecker
    fill_wait_time: int
    address: ChecksumAddress
    latest_blocks: Dict[ChainId, BlockData]


HandlerResult = Tuple[bool, Optional[List[Event]]]


def process_event(event: Event, context: Context) -> HandlerResult:
    log.debug("Processing event", _event=event)

    if isinstance(event, LatestBlockUpdatedEvent):
        return _handle_latest_block_updated(event, context), None

    elif isinstance(event, RequestCreated):
        return _handle_request_created(event, context), None

    elif isinstance(event, RequestFilled):
        return _handle_request_filled(event, context), None

    elif isinstance(event, DepositWithdrawn):
        return _handle_deposit_withdrawn(event, context), None

    elif isinstance(event, ClaimMade):
        return _handle_claim_made(event, context)

    elif isinstance(event, ClaimWithdrawn):
        return _handle_claim_withdrawn(event, context), None

    elif isinstance(event, (RequestResolved, FillHashInvalidated, InitiateL1ResolutionEvent)):
        return False, None

    else:
        raise RuntimeError("Unrecognized event type")


def _handle_latest_block_updated(event: LatestBlockUpdatedEvent, context: Context) -> bool:
    context.latest_blocks[event.chain_id] = event.block_data
    return True


def _handle_request_created(event: RequestCreated, context: Context) -> bool:
    with beamer.metrics.update() as data:
        data.requests_created.inc()

    # If `BEAMER_ALLOW_UNLISTED_PAIRS` is set, do not check token match file
    if os.environ.get("BEAMER_ALLOW_UNLISTED_PAIRS") is not None:
        # Check if the address points to some contract
        if context.fill_manager.web3.eth.get_code(event.target_token_address) == HexBytes("0x"):
            log.info(
                "Request unfillable, invalid token contract",
                request_event=event,
                token_address=event.target_token_address,
            )
            return True
    else:
        is_valid_request = context.match_checker.is_valid_pair(
            event.chain_id,
            event.source_token_address,
            event.target_chain_id,
            event.target_token_address,
        )

        if not is_valid_request:
            log.debug("Invalid token pair in request", _event=event)
            return True

    request = Request(
        request_id=event.request_id,
        source_chain_id=event.chain_id,
        target_chain_id=event.target_chain_id,
        source_token_address=event.source_token_address,
        target_token_address=event.target_token_address,
        target_address=event.target_address,
        amount=event.amount,
        valid_until=event.valid_until,
    )
    context.requests.add(request.id, request)
    return True


def _handle_request_filled(event: RequestFilled, context: Context) -> bool:
    with beamer.metrics.update() as data:
        data.requests_filled.inc()
        if event.filler == context.address:
            data.requests_filled_by_agent.inc()

    request = context.requests.get(event.request_id)
    if request is None:
        return False

    fill_matches_request = (
        request.id == event.request_id
        and request.amount == event.amount
        and request.source_chain_id == event.source_chain_id
        and request.target_token_address == event.target_token_address
    )
    if not fill_matches_request:
        log.warn("Fill not matching request. Ignoring.", request=request, fill=event)
        return True

    try:
        request.fill(filler=event.filler, fill_tx=event.tx_hash, fill_id=event.fill_id)
    except TransitionNotAllowed:
        return False

    log.info("Request filled", request=request)
    return True


def _handle_deposit_withdrawn(event: DepositWithdrawn, context: Context) -> bool:
    request = context.requests.get(event.request_id)
    if request is None:
        return False

    try:
        request.withdraw()
    except TransitionNotAllowed:
        return False

    log.info("Deposit withdrawn", request=request)
    return True


def _l1_resolution_criteria_fulfilled(claim: Claim, context: Context) -> bool:
    l1_resolution_gas_cost = 1_000_000  # FIXME
    l1_gas_price = 1e9  # FIXME
    l1_safety_factor = 1.25
    limit = int(l1_resolution_gas_cost * l1_gas_price * l1_safety_factor)

    if claim.claimer == context.address:
        if claim._latest_claim_made.challenger_stake > limit:
            return True
    elif claim.challenger == context.address:
        if claim._latest_claim_made.claimer_stake > limit:
            return True

    return False


def _handle_claim_made(event: ClaimMade, context: Context) -> HandlerResult:
    claim = context.claims.get(event.claim_id)
    request = context.requests.get(event.request_id)

    events: Optional[List[Event]] = None

    # RequestCreated event must arrive before ClaimMade
    # Additionally, a request should never be dropped before all claims are finalized
    assert request is not None, "Request object missing upon ClaimMade event"

    if claim is None:
        challenge_back_off_timestamp = int(time.time())
        # if fill event is not fetched yet, wait `_fill_wait_time`
        # to give the target chain time to sync before challenging
        # additionally, if we are already in the challenge game, no need to back off
        if request.filler is None and event.challenger_stake == 0:
            challenge_back_off_timestamp += context.fill_wait_time
        claim = Claim(event, challenge_back_off_timestamp)
        context.claims.add(claim.id, claim)

        return True, events

    # this is at least the second ClaimMade event for this claim id
    assert event.challenger != ADDRESS_ZERO, "Second ClaimMade event must contain challenger"
    try:
        # Agent is not part of ongoing challenge
        if context.address not in {event.claimer, event.challenger}:
            claim.ignore(event)
        claim.challenge(event)

        if _l1_resolution_criteria_fulfilled(claim, context):
            events = [
                InitiateL1ResolutionEvent(
                    chain_id=request.target_chain_id,
                    request_id=request.id,
                )
            ]
    except TransitionNotAllowed:
        return False, events

    log.info("Request claimed", request=request, claim_id=event.claim_id)
    return True, events


def _handle_claim_withdrawn(event: ClaimWithdrawn, context: Context) -> bool:
    claim = context.claims.get(event.claim_id)

    # Check if claim exists, it could happen that we ignored the request because of an
    # invalid token pair, and therefore also did not create the claim
    if claim is None:
        return False

    claim.withdraw()
    return True
