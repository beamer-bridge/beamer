import time
from dataclasses import dataclass

import structlog
from eth_typing import ChecksumAddress
from hexbytes import HexBytes
from statemachine.exceptions import TransitionNotAllowed
from web3.constants import ADDRESS_ZERO
from web3.contract import Contract

from beamer.events import (
    ClaimMade,
    ClaimWithdrawn,
    DepositWithdrawn,
    Event,
    RequestCreated,
    RequestFilled,
)
from beamer.request import Claim, Request, Tracker
from beamer.typing import ClaimId, RequestId
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


def process_event(event: Event, context: Context) -> bool:
    log.debug("Processing event", _event=event)

    if isinstance(event, RequestCreated):
        return _handle_request_created(event, context)

    elif isinstance(event, RequestFilled):
        return _handle_request_filled(event, context)

    elif isinstance(event, DepositWithdrawn):
        return _handle_deposit_withdrawn(event, context)

    elif isinstance(event, ClaimMade):
        return _handle_claim_made(event, context)

    elif isinstance(event, ClaimWithdrawn):
        return _handle_claim_withdrawn(event, context)

    else:
        raise RuntimeError("Unrecognized event type")


def _handle_request_created(event: RequestCreated, context: Context) -> bool:
    # Check if the address points to a valid token
    if context.fill_manager.web3.eth.get_code(event.target_token_address) == HexBytes("0x"):
        log.info(
            "Request unfillable, invalid token contract",
            request_event=event,
            token_address=event.target_token_address,
        )
        return True

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
        request.fill(filler=event.filler, fill_id=event.fill_id)
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


def _handle_claim_made(event: ClaimMade, context: Context) -> bool:
    claim = context.claims.get(event.claim_id)
    request = context.requests.get(event.request_id)
    if request is None:
        return False

    if claim is None:
        challenge_back_off_timestamp = int(time.time())
        # if fill event is not fetched yet, wait `_fill_wait_time`
        # to give the target chain time to sync before challenging
        # additionally, if we are already in the challenge game, no need to back off
        if request.filler is None and event.challenger_stake == 0:
            challenge_back_off_timestamp += context.fill_wait_time
        claim = Claim(event, challenge_back_off_timestamp)
        context.claims.add(claim.id, claim)

        return True

    # this is at least the second ClaimMade event for this claim id
    assert event.challenger != ADDRESS_ZERO, "Second ClaimMade event must contain challenger"
    try:
        # Agent is not part of ongoing challenge
        if context.address not in {event.claimer, event.challenger}:
            claim.ignore(event)
        claim.challenge(event)
    except TransitionNotAllowed:
        return False

    log.info("Request claimed", request=request, claim_id=event.claim_id)
    return True


def _handle_claim_withdrawn(event: ClaimWithdrawn, context: Context) -> bool:
    claim = context.claims.get(event.claim_id)

    # Check if claim exists, it could happen that we ignored the request because of an
    # invalid token pair, and therefore also did not create the claim
    if claim is None:
        return False

    claim.withdraw()
    return True
