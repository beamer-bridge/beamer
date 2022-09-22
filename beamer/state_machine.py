import os
import time
from concurrent.futures import Executor, Future
from dataclasses import dataclass, field
from typing import Optional

import structlog
from eth_typing import ChecksumAddress
from hexbytes import HexBytes
from statemachine.exceptions import TransitionNotAllowed
from web3 import Web3
from web3.constants import ADDRESS_ZERO
from web3.contract import Contract
from web3.types import BlockData, Timestamp

import beamer.metrics
from beamer.config import Config
from beamer.events import (
    ClaimMade,
    ClaimStakeWithdrawn,
    DepositWithdrawn,
    Event,
    FillHashInvalidated,
    FinalityPeriodUpdated,
    HashInvalidated,
    InitiateL1InvalidationEvent,
    InitiateL1ResolutionEvent,
    LatestBlockUpdatedEvent,
    RequestCreated,
    RequestFilled,
    RequestResolved,
)
from beamer.l1_resolution import run_relayer_for_tx
from beamer.models.claim import Claim
from beamer.models.request import Request
from beamer.tracker import Tracker
from beamer.typing import ChainId, ClaimId, FillHash, RequestHash, RequestId
from beamer.util import TokenMatchChecker

log = structlog.get_logger(__name__)


@dataclass
class Context:
    requests: Tracker[RequestId, Request]
    claims: Tracker[ClaimId, Claim]
    request_manager: Contract
    fill_manager: Contract
    match_checker: TokenMatchChecker
    address: ChecksumAddress
    latest_blocks: dict[ChainId, BlockData]
    config: Config
    web3_l1: Web3
    task_pool: Executor
    l1_resolutions: dict[tuple[RequestId, ClaimId], Future]
    finality_periods: dict[ChainId, int] = field(default_factory=dict)


HandlerResult = tuple[bool, Optional[list[Event]]]


def process_event(event: Event, context: Context) -> HandlerResult:
    if isinstance(event, LatestBlockUpdatedEvent):
        return _handle_latest_block_updated(event, context)

    elif isinstance(event, RequestCreated):
        return _handle_request_created(event, context)

    elif isinstance(event, RequestFilled):
        return _handle_request_filled(event, context)

    elif isinstance(event, DepositWithdrawn):
        return _handle_deposit_withdrawn(event, context)

    elif isinstance(event, ClaimMade):
        return _handle_claim_made(event, context)

    elif isinstance(event, ClaimStakeWithdrawn):
        return _handle_claim_stake_withdrawn(event, context)

    elif isinstance(event, RequestResolved):
        return _handle_request_resolved(event, context)

    elif isinstance(event, HashInvalidated):
        return _handle_hash_invalidated(event, context)

    elif isinstance(event, FillHashInvalidated):
        return _handle_fill_hash_invalidated(event, context)

    elif isinstance(event, InitiateL1ResolutionEvent):
        return _handle_initiate_l1_resolution(event, context)

    elif isinstance(event, InitiateL1InvalidationEvent):
        return _handle_initiate_l1_invalidation(event, context)

    elif isinstance(event, FinalityPeriodUpdated):
        return _handle_finality_period_updated(event, context)

    else:
        raise RuntimeError("Unrecognized event type")


def _find_claims_by_fill_hash(context: Context, fill_hash: FillHash) -> list[Claim]:
    """
    This returns a list, as there can be multiple claims with the same fill hash
    """
    matching_claims = []
    for claim in context.claims:
        request = context.requests.get(claim.request_id)
        assert request is not None

        if fill_hash == request.fill_hash_with_fill_id(claim.fill_id):
            matching_claims.append(claim)

    return matching_claims


def _find_request_by_request_hash(
    context: Context, request_hash: RequestHash
) -> Optional[Request]:
    for request in context.requests:
        if request.request_hash == request_hash:
            return request
    return None


def _invalidation_ready_for_l1_relay(claim: Claim) -> bool:
    return (
        not claim.is_invalidated_l1_resolved
        and claim.invalidation_tx is not None
        and claim.invalidation_timestamp is not None
    )


def _proof_ready_for_l1_relay(request: Request) -> bool:
    return (
        not request.is_l1_resolved
        and request.fill_tx is not None
        and request.fill_timestamp is not None
    )


def _timestamp_is_l1_finalized(
    timestamp: Timestamp, context: Context, target_chain_id: ChainId
) -> bool:
    # The entry in `finality_periods` must exist, because it is checked during request creation
    # target_chain_finality = context.finality_periods[target_chain_id]

    # FIXME: Remove this for the above once the contracts with the event are deployed
    target_chain_finality = context.finality_periods.get(target_chain_id)
    if target_chain_finality is None:
        target_chain_finality = context.request_manager.functions.finalityPeriods(
            target_chain_id
        ).call()

    return int(time.time()) > timestamp + target_chain_finality


def _handle_latest_block_updated(
    event: LatestBlockUpdatedEvent, context: Context
) -> HandlerResult:
    context.latest_blocks[event.chain_id] = event.block_data
    return True, None


def _handle_request_created(event: RequestCreated, context: Context) -> HandlerResult:
    # If `BEAMER_ALLOW_UNLISTED_PAIRS` is set, ignore the token configuration
    if os.environ.get("BEAMER_ALLOW_UNLISTED_PAIRS") is not None:
        # Check if the address points to some contract
        if context.fill_manager.web3.eth.get_code(event.target_token_address) == HexBytes("0x"):
            log.info(
                "Request unfillable, invalid token contract",
                request_event=event,
                token_address=event.target_token_address,
            )
            return True, None
    else:
        is_valid_request = context.match_checker.is_valid_pair(
            event.chain_id,
            event.source_token_address,
            event.target_chain_id,
            event.target_token_address,
        )

        if not is_valid_request:
            log.debug("Invalid token pair in request", _event=event)
            return True, None

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

    # We only count valid requests from the agent's perspective to reason about
    # the ratio of fills to valid requests
    with beamer.metrics.update() as data:
        data.requests_created.inc()

    return True, None


def _handle_request_filled(event: RequestFilled, context: Context) -> HandlerResult:
    request = context.requests.get(event.request_id)
    if request is None:
        return False, None

    fill_matches_request = (
        request.id == event.request_id
        and request.amount == event.amount
        and request.source_chain_id == event.source_chain_id
        and request.target_token_address == event.target_token_address
    )
    if not fill_matches_request:
        log.warn("Fill not matching request. Ignoring.", request=request, fill=event)
        return True, None

    if request.is_withdrawn:
        return True, None

    try:
        fill_block = context.fill_manager.web3.eth.get_block(event.block_number)
        request.fill(
            filler=event.filler,
            fill_tx=event.tx_hash,
            fill_id=event.fill_id,
            fill_timestamp=fill_block.timestamp,  # type: ignore
        )
    except TransitionNotAllowed:
        return False, None

    with beamer.metrics.update() as data:
        data.requests_filled.inc()
        if event.filler == context.address:
            data.requests_filled_by_agent.inc()

    return True, None


def _handle_deposit_withdrawn(event: DepositWithdrawn, context: Context) -> HandlerResult:
    request = context.requests.get(event.request_id)
    if request is None:
        return True, None

    try:
        request.withdraw()
    except TransitionNotAllowed:
        return False, None

    return True, None


def _handle_claim_made(event: ClaimMade, context: Context) -> HandlerResult:
    # RequestCreated event must arrive before ClaimMade
    # Additionally, a request should never be dropped before all claims are finalized
    request = context.requests.get(event.request_id)
    if request is None:
        # We might not find the request because we dropped it for some reason
        # (e.g. an invalid token pair).
        return True, None

    # If we haven't seen the fill event for own claim, don't process
    if request.is_pending and event.claimer == context.address:
        return False, None

    claim = context.claims.get(event.claim_id)

    if claim is None:
        if event.last_challenger != ADDRESS_ZERO:
            return False, None

        challenge_back_off_timestamp = int(time.time())
        # if fill event is not fetched yet, wait `_fill_wait_time`
        # to give the target chain time to sync before challenging
        # additionally, if we are already in the challenge game, no need to back off
        if request.filler is None:
            challenge_back_off_timestamp += context.config.fill_wait_time
        claim = Claim(event, challenge_back_off_timestamp)
        context.claims.add(claim.id, claim)

        return True, None

    # Don't process challenge events before there was a chance to invalidate the claim
    if claim.is_started:
        claim.unprocessed_claim_made_events.add(event)
        return False, None

    events: list[Event] = []
    if _invalidation_ready_for_l1_relay(claim):
        events.append(
            InitiateL1InvalidationEvent(
                chain_id=request.target_chain_id,  # Resolution happens on the target chain
                claim_id=claim.id,
            )
        )

    # this is at least the second ClaimMade event for this claim id
    assert event.last_challenger != ADDRESS_ZERO, "Second ClaimMade event must contain challenger"
    try:
        claim.challenge(event)
    except TransitionNotAllowed:
        claim.unprocessed_claim_made_events.add(event)
        return False, events

    claim.unprocessed_claim_made_events.discard(event)

    if _proof_ready_for_l1_relay(request):
        events.append(
            InitiateL1ResolutionEvent(
                chain_id=request.target_chain_id,  # Resolution happens on the target chain
                request_id=request.id,
                claim_id=claim.id,
            )
        )

    log.debug("Request claimed", request=request, claim_id=event.claim_id)
    return True, events


def _handle_claim_stake_withdrawn(event: ClaimStakeWithdrawn, context: Context) -> HandlerResult:
    claim = context.claims.get(event.claim_id)

    # Check if request exists, it could happen that we ignored it because of an
    # invalid token pair, and therefore also did not create any claims to it
    if context.requests.get(event.request_id) is None:
        return True, None

    # It can happen that ClaimMade events have not been processed yet because of a missing
    # preceding event (i.e. if the agent filled the request, we need to first process the
    # corresponding RequestFilled event.
    if claim is None or claim.unprocessed_claim_made_events:
        log.debug(
            "Unprocessed ClaimMade events in event loop. Cannot withdraw",
            withdraw_event=event,
            claim_id=event.claim_id,
        )
        return False, None

    claim.withdraw()
    return True, None


def _handle_request_resolved(event: RequestResolved, context: Context) -> HandlerResult:
    request = _find_request_by_request_hash(context, event.request_hash)
    if request is not None:
        try:
            request.l1_resolve(event.filler, event.fill_id)
        except TransitionNotAllowed:
            return False, None
    return True, None


def _handle_hash_invalidated(event: HashInvalidated, context: Context) -> HandlerResult:
    fill_block = context.fill_manager.web3.eth.get_block(event.block_number)
    claims = _find_claims_by_fill_hash(context, event.fill_hash)

    for claim in claims:
        claim.start_challenge(event.tx_hash, fill_block.timestamp)  # type: ignore

    return True, None


def _handle_fill_hash_invalidated(event: FillHashInvalidated, context: Context) -> HandlerResult:
    claims = _find_claims_by_fill_hash(context, event.fill_hash)
    for claim in claims:
        claim.l1_invalidate()

    return True, None


def _l1_resolution_threshold_reached(claim: Claim, context: Context) -> bool:
    l1_gas_cost = 1_000_000  # TODO: Adapt to real price
    l1_gas_price = context.web3_l1.eth.gas_price
    l1_safety_factor = 1.25
    limit = int(l1_gas_cost * l1_gas_price * l1_safety_factor)

    # Agent is claimer
    if claim.claimer == context.address:
        if claim.latest_claim_made.challenger_stake_total > limit:
            return True
    else:
        # Agent is challenger
        reward = claim.get_challenger_stake(context.address)
        last_challenger = claim.latest_claim_made.last_challenger
        if last_challenger == context.address:
            reward -= (
                claim.latest_claim_made.challenger_stake_total
                - claim.latest_claim_made.claimer_stake
            )

        if reward > limit:
            return True
    return False


def _handle_initiate_l1_resolution(
    event: InitiateL1ResolutionEvent, context: Context
) -> HandlerResult:
    request = context.requests.get(event.request_id)
    claim = context.claims.get(event.claim_id)
    if claim is None:
        return True, None

    # A request should never be dropped before all claims are finalized
    assert request is not None, "Request object missing"
    assert request.fill_tx is not None, "Request not yet filled"
    assert request.fill_timestamp is not None, "Request not yet filled"

    # Check that message is finalized on L1
    if not _timestamp_is_l1_finalized(request.fill_timestamp, context, request.target_chain_id):
        return False, None

    # Check if L1 resolution is cheaper than the winning from challenge
    if _l1_resolution_threshold_reached(claim, context):
        future = context.task_pool.submit(
            run_relayer_for_tx,
            context.config.l1_rpc_url,
            context.config.l2b_rpc_url,
            context.config.account.key,
            request.fill_tx,
        )

        def on_future_done(f: Future) -> None:
            try:
                f.result()
                assert request is not None, "Request object missing"
                assert claim is not None, "Claim object missing"

                del context.l1_resolutions[(request.id, claim.id)]
            except Exception as ex:
                log.error("L1 resolution failed", ex=ex)

        future.add_done_callback(on_future_done)
        context.l1_resolutions[(request.id, claim.id)] = future
        request.l1_resolve()

        log.info("Initiated L1 resolution", request=request, claim=claim)

        return True, None
    return False, None


def _handle_initiate_l1_invalidation(
    event: InitiateL1InvalidationEvent, context: Context
) -> HandlerResult:
    claim = context.claims.get(event.claim_id)
    if claim is None:
        return True, None

    # A request should never be dropped before all claims are finalized
    request = context.requests.get(claim.request_id)
    assert request is not None, "Request object missing"
    assert claim.invalidation_tx is not None, "Claim not invalidated"
    assert claim.invalidation_timestamp is not None, "Claim not invalidated"

    # Check that message is finalized on L1
    if not _timestamp_is_l1_finalized(
        claim.invalidation_timestamp, context, request.target_chain_id
    ):
        return False, None

    # Check if L1 resolution is cheaper than the winning from challenge
    if _l1_resolution_threshold_reached(claim, context):
        future = context.task_pool.submit(
            run_relayer_for_tx,
            context.config.l1_rpc_url,
            context.config.l2b_rpc_url,
            context.config.account.key,
            claim.invalidation_tx,
        )

        def on_future_done(f: Future) -> None:
            try:
                f.result()
                assert request is not None, "Request object missing"
                assert claim is not None, "Claim object missing"

                del context.l1_resolutions[(request.id, claim.id)]
            except Exception as ex:
                log.error("L1 invalidation failed", ex=ex)

        future.add_done_callback(on_future_done)
        context.l1_resolutions[(request.id, claim.id)] = future
        claim.l1_invalidate()

        log.info("Initiated L1 invalidation", request=request, claim=claim)

    return True, None


def _handle_finality_period_updated(
    event: FinalityPeriodUpdated, context: Context
) -> HandlerResult:
    context.finality_periods[event.target_chain_id] = event.finality_period
    return True, None
