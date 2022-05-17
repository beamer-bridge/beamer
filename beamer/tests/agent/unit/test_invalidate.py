import time

import pytest
from hexbytes import HexBytes

from beamer.chain import process_claims
from beamer.events import FillHashInvalidated, HashInvalidated
from beamer.state_machine import process_event
from beamer.tests.agent.unit.utils import (
    FILL_ID,
    make_claim_challenged,
    make_context,
    make_request,
)
from beamer.typing import ClaimId, FillId


def test_handle_fill_hash_invalidated():
    context, config = make_context()

    request = make_request()
    request.fill(config.account.address, b"", FILL_ID)
    context.requests.add(request.id, request)
    assert request.fill_id is not None

    claim_1 = make_claim_challenged(
        request=request, claimer=config.account.address, fill_id=request.fill_id
    )
    claim_2 = make_claim_challenged(
        request=request,
        claim_id=ClaimId(claim_1.id + 1),
        claimer=config.account.address,
        fill_id=FillId(b"c0ffee"),
    )
    context.claims.add(claim_1.id, claim_1)
    context.claims.add(claim_2.id, claim_2)

    fill_hash = request.fill_hash_with_fill_id(request.fill_id)
    event = FillHashInvalidated(
        chain_id=request.target_chain_id,
        tx_hash=HexBytes(""),
        fill_hash=fill_hash,
    )
    assert process_event(event, context) == (True, None)

    # Check that a matching event invalidates the claim
    assert claim_1.is_invalidated_l1_resolved  # pylint:disable=no-member

    # Check that a non-matching event does not invalidate the claim
    assert claim_2.is_claimer_winning  # pylint:disable=no-member


def test_handle_hash_invalidated():
    context, config = make_context()

    request = make_request()
    request.fill(config.account.address, b"", FILL_ID)
    context.requests.add(request.id, request)
    assert request.fill_id is not None

    claim_1 = make_claim_challenged(
        request=request, claimer=config.account.address, fill_id=request.fill_id
    )
    claim_2 = make_claim_challenged(
        request=request,
        claim_id=ClaimId(claim_1.id + 1),
        claimer=config.account.address,
        fill_id=FillId(b"c0ffee"),
    )
    context.claims.add(claim_1.id, claim_1)
    context.claims.add(claim_2.id, claim_2)

    fill_hash = request.fill_hash_with_fill_id(request.fill_id)
    event = HashInvalidated(
        chain_id=request.target_chain_id,
        tx_hash=HexBytes(""),
        request_hash=request.request_hash,
        fill_id=request.fill_id,
        fill_hash=fill_hash,
    )
    assert process_event(event, context) == (True, None)

    # Check that a matching event invalidates the claim
    assert claim_1.is_invalidated  # pylint:disable=no-member

    # Check that a non-matching event does not invalidate the claim
    assert claim_2.is_claimer_winning  # pylint:disable=no-member


def test_maybe_invalidate_claim_wrong_fill_id():
    context, config = make_context()

    request = make_request(valid_until=int(time.time() * 2))
    request.fill(config.account.address, b"", FILL_ID)
    context.requests.add(request.id, request)

    claim_event = make_claim(
        request=request, claimer=config.account.address, fill_id=FillId(b"c0ffee")
    ).latest_claim_made
    process_event(claim_event, context)

    claim = context.claims.get(claim_event.claim_id)
    assert claim is not None

    assert not claim.is_invalidated
    process_claims(context)
    assert claim.is_invalidated
    assert claim.transaction_pending


def test_maybe_invalidate_claim_wrong_fill_id_but_in_back_off():
    context, config = make_context()

    request = make_request()
    request.fill(config.account.address, b"", FILL_ID)
    context.requests.add(request.id, request)

    claim_event = make_claim(
        request=request,
        claimer=config.account.address,
        fill_id=FillId(b"c0ffee"),
    ).latest_claim_made
    assert request.fill_id != claim_event.fill_id
    process_event(claim_event, context)

    claim = context.claims.get(claim_event.claim_id)
    assert claim is not None
    claim.challenge_back_off_timestamp = int(time.time() + 100)

    assert not claim.is_invalidated
    process_claims(context)
    assert not claim.is_invalidated
    assert not claim.transaction_pending


def test_maybe_invalidate_claim_wrong_fill_id_but_timed_out():
    context, config = make_context()

    request = make_request(valid_until=int(time.time() / 2))
    request.fill(config.account.address, b"", FILL_ID)
    context.requests.add(request.id, request)

    claim_event = make_claim(
        request=request, claimer=config.account.address, fill_id=FillId(b"c0ffee")
    ).latest_claim_made
    assert request.fill_id != claim_event.fill_id
    process_event(claim_event, context)

    claim = context.claims.get(claim_event.claim_id)
    assert claim is not None

    assert not claim.is_invalidated
    process_claims(context)
    assert not claim.is_invalidated
    assert not claim.transaction_pending
