import os
import time
from concurrent.futures import Executor, Future
from dataclasses import dataclass, field
from threading import Lock
from typing import Optional, cast

import structlog
from eth_typing import ChecksumAddress
from hexbytes import HexBytes
from statemachine.exceptions import TransitionNotAllowed
from web3 import HTTPProvider, Web3
from web3.constants import ADDRESS_ZERO
from web3.contract import Contract
from web3.types import BlockData, Timestamp

import beamer.agent.metrics
from beamer.agent.config import Config
from beamer.agent.events import (
    ChainUpdated,
    ClaimMade,
    ClaimStakeWithdrawn,
    DepositWithdrawn,
    Event,
    FillInvalidated,
    FillInvalidatedResolved,
    InitiateL1InvalidationEvent,
    InitiateL1ResolutionEvent,
    LatestBlockUpdatedEvent,
    RequestCreated,
    RequestFilled,
    RequestResolved,
    SourceChainEvent,
    TargetChainEvent,
)
from beamer.agent.l1_resolution import run_relayer_for_tx
from beamer.agent.models.claim import Claim
from beamer.agent.models.request import Request
from beamer.agent.tracker import Tracker
from beamer.agent.typing import URL, ChainId, ClaimId, FillId, RequestId
from beamer.agent.util import TokenChecker

log = structlog.get_logger(__name__)


@dataclass
class Context:
    requests: Tracker[RequestId, Request]
    claims: Tracker[ClaimId, Claim]
    source_chain_id: ChainId
    target_chain_id: ChainId
    request_manager: Contract
    fill_manager: Contract
    token_checker: TokenChecker
    address: ChecksumAddress
    latest_blocks: dict[ChainId, BlockData]
    config: Config
    web3_l1: Web3
    task_pool: Executor
    claim_request_extension: int
    l1_resolutions: dict[RequestId, Future]
    l1_invalidations: dict[ClaimId, Future]
    fill_mutexes: dict[tuple[ChainId, ChecksumAddress], Lock]
    logger: structlog.BoundLogger
    finality_periods: dict[ChainId, int] = field(default_factory=dict)

    @property
    def source_rpc_url(self) -> URL:
        provider = cast(HTTPProvider, self.request_manager.w3.provider)
        assert provider.endpoint_uri is not None
        return URL(provider.endpoint_uri)

    @property
    def target_rpc_url(self) -> URL:
        provider = cast(HTTPProvider, self.fill_manager.w3.provider)
        assert provider.endpoint_uri is not None
        return URL(provider.endpoint_uri)


HandlerResult = tuple[bool, Optional[list[Event]]]


def process_event(event: Event, context: Context) -> HandlerResult:
    if isinstance(event, SourceChainEvent) and event.chain_id != context.source_chain_id:
        return True, None
    if isinstance(event, TargetChainEvent) and event.chain_id != context.target_chain_id:
        return True, None

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

    elif isinstance(event, FillInvalidated):
        return _handle_fill_invalidated(event, context)

    elif isinstance(event, FillInvalidatedResolved):
        return _handle_fill_invalidated_resolved(event, context)

    elif isinstance(event, InitiateL1ResolutionEvent):
        return _handle_initiate_l1_resolution(event, context)

    elif isinstance(event, InitiateL1InvalidationEvent):
        return _handle_initiate_l1_invalidation(event, context)

    elif isinstance(event, ChainUpdated):
        return _handle_chain_updated(event, context)

    else:
        raise RuntimeError("Unrecognized event type")


def _find_claims(context: Context, request_id: RequestId, fill_id: FillId) -> list[Claim]:
    """
    This returns a list with matching request ID and fill ID, as there can be multiple claims
    """
    matching_claims = []
    for claim in context.claims:
        if claim.request_id == request_id and claim.fill_id == fill_id:
            matching_claims.append(claim)

    return matching_claims


def _invalidation_ready_for_l1_relay(claim: Claim) -> bool:
    return (
        not claim.invalidated_l1_resolved.is_active
        and claim.invalidation_tx is not None
        and claim.invalidation_timestamp is not None
    )


def _proof_ready_for_l1_relay(request: Request) -> bool:
    return (
        not request.l1_resolved.is_active
        and request.fill_tx is not None
        and request.fill_timestamp is not None
    )


def _timestamp_is_l1_finalized(
    timestamp: Timestamp, context: Context, target_chain_id: ChainId
) -> bool:
    # The internal memory should not be none because at this point
    # the ChainUpdated event must have arrived, otherwise there would be no request
    target_chain_finality = context.finality_periods[target_chain_id]
    return int(time.time()) > timestamp + target_chain_finality


def _handle_latest_block_updated(
    event: LatestBlockUpdatedEvent, context: Context
) -> HandlerResult:
    context.latest_blocks[event.chain_id] = event.block_data
    return True, None


def _handle_request_created(event: RequestCreated, context: Context) -> HandlerResult:

    if event.target_chain_id != context.target_chain_id:
        return True, None

    # If `BEAMER_ALLOW_UNLISTED_PAIRS` is set, ignore the token configuration
    if os.environ.get("BEAMER_ALLOW_UNLISTED_PAIRS") is not None:
        # Check if the address points to some contract
        if context.fill_manager.w3.eth.get_code(event.target_token_address) == HexBytes("0x"):
            log.info(
                "Request unfillable, invalid token contract",
                request_event=event,
                token_address=event.target_token_address,
            )
            return True, None
    else:
        is_valid_request = context.token_checker.is_valid_pair(
            event.chain_id,
            event.source_token_address,
            event.target_chain_id,
            event.target_token_address,
        )

        if not is_valid_request:
            context.logger.debug("Invalid token pair in request", _event=event)
            return True, None

    request = Request(
        request_id=event.request_id,
        source_chain_id=event.chain_id,
        target_chain_id=event.target_chain_id,
        source_token_address=event.source_token_address,
        target_token_address=event.target_token_address,
        target_address=event.target_address,
        amount=event.amount,
        nonce=event.nonce,
        valid_until=event.valid_until,
    )
    context.requests.add(request.id, request)

    # We only count valid requests from the agent's perspective to reason about
    # the ratio of fills to valid requests
    with beamer.agent.metrics.update() as data:
        data.requests_created.inc()

    return True, None


def _handle_request_filled(event: RequestFilled, context: Context) -> HandlerResult:
    request = context.requests.get(event.request_id)
    if event.source_chain_id != context.source_chain_id:
        context.logger.debug("Filled for different source chain", _event=event)
        return True, None

    if request is None:
        return False, None

    fill_matches_request = (
        request.id == event.request_id
        and request.amount == event.amount
        and request.source_chain_id == event.source_chain_id
        and request.target_token_address == event.target_token_address
    )
    if not fill_matches_request:
        context.logger.warn("Fill not matching request. Ignoring.", request=request, fill=event)
        return True, None

    if request.withdrawn.is_active:
        return True, None

    try:
        fill_block = context.fill_manager.w3.eth.get_block(event.block_number)
        request.fill(
            filler=event.filler,
            fill_tx=event.tx_hash,
            fill_id=event.fill_id,
            fill_timestamp=fill_block.timestamp,  # type: ignore
        )
    except TransitionNotAllowed:
        return False, None

    with beamer.agent.metrics.update() as data:
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
    if request.pending.is_active and event.claimer == context.address:
        return False, None

    if request.filled.is_active and event.claimer == context.address:
        request.try_to_claim()

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
        if claim.fill_id in request.invalid_fill_ids:
            tx_hash, timestamp = request.invalid_fill_ids[claim.fill_id]
            claim.start_challenge(tx_hash, timestamp)
        if claim.fill_id in request.l1_resolution_invalid_fill_ids:
            claim.start_challenge()
            claim.l1_invalidate()
        context.claims.add(claim.id, claim)

        return True, None

    # Don't process challenge events before there was a chance to invalidate the claim
    if claim.started.is_active:
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

    context.logger.debug("Request claimed", request=request, claim_id=event.claim_id)
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
        context.logger.debug(
            "Unprocessed ClaimMade events in event loop. Cannot withdraw",
            withdraw_event=event,
            claim_id=event.claim_id,
        )
        return False, None

    claim.withdraw()
    return True, None


def _handle_request_resolved(event: RequestResolved, context: Context) -> HandlerResult:
    request = context.requests.get(event.request_id)
    if request is not None:
        try:
            request.l1_resolve(event.filler, event.fill_id)
            request.invalid_fill_ids.pop(event.fill_id, None)
        except TransitionNotAllowed:
            return False, None
    return True, None


def _handle_fill_invalidated(event: FillInvalidated, context: Context) -> HandlerResult:
    fill_block = context.fill_manager.w3.eth.get_block(event.block_number)
    timestamp = fill_block.timestamp  # type: ignore
    request = context.requests.get(event.request_id)

    if request is not None:
        # If we get more invalidation events for the same fill ID, just ignore them.
        if event.fill_id in request.invalid_fill_ids:
            return True, None
        request.invalid_fill_ids[event.fill_id] = event.tx_hash, timestamp

    claims = _find_claims(context, event.request_id, event.fill_id)
    for claim in claims:
        claim.start_challenge(event.tx_hash, timestamp)

    return True, None


def _handle_fill_invalidated_resolved(
    event: FillInvalidatedResolved, context: Context
) -> HandlerResult:
    claims = _find_claims(context, event.request_id, event.fill_id)
    for claim in claims:
        claim.l1_invalidate()
        request = context.requests.get(claim.request_id)
        assert request is not None
        request.l1_resolution_invalid_fill_ids.add(claim.fill_id)

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

    # There is already a process running
    if request.id in context.l1_resolutions:
        return True, None

    # Check if L1 resolution is cheaper than the winning from challenge
    if _l1_resolution_threshold_reached(claim, context):
        future = context.task_pool.submit(
            run_relayer_for_tx,
            context.config.rpc_urls["l1"],
            context.target_rpc_url,
            context.source_rpc_url,
            context.config.account.key,
            request.fill_tx,
        )

        def on_future_done(f: Future) -> None:
            try:
                f.result()
                assert request is not None, "Request object missing"
                assert claim is not None, "Claim object missing"

                del context.l1_resolutions[request.id]
            except Exception as ex:
                context.logger.error("L1 resolution failed", ex=ex)

        future.add_done_callback(on_future_done)
        context.l1_resolutions[request.id] = future
        request.l1_resolve()

        context.logger.info("Initiated L1 resolution", request=request, claim=claim)

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

    # There is already a process running
    if claim.id in context.l1_invalidations:
        return True, None

    # Check if L1 resolution is cheaper than the winning from challenge
    if _l1_resolution_threshold_reached(claim, context):
        future = context.task_pool.submit(
            run_relayer_for_tx,
            context.config.rpc_urls["l1"],
            context.target_rpc_url,
            context.source_rpc_url,
            context.config.account.key,
            claim.invalidation_tx,
        )

        def on_future_done(f: Future) -> None:
            try:
                f.result()
                assert request is not None, "Request object missing"
                assert claim is not None, "Claim object missing"

                del context.l1_invalidations[claim.id]
            except Exception as ex:
                context.logger.error("L1 invalidation failed", ex=ex)

        future.add_done_callback(on_future_done)
        context.l1_invalidations[claim.id] = future
        claim.l1_invalidate()

        context.logger.info("Initiated L1 invalidation", request=request, claim=claim)

    return True, None


def _handle_chain_updated(event: ChainUpdated, context: Context) -> HandlerResult:
    context.finality_periods[event.chain_id] = event.finality_period
    return True, None
