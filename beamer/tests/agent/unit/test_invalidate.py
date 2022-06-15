import time
from copy import deepcopy
from unittest.mock import patch

import pytest
from hexbytes import HexBytes

from beamer.chain import process_claims
from beamer.events import FillHashInvalidated, HashInvalidated, InitiateL1InvalidationEvent
from beamer.state_machine import process_event
from beamer.tests.agent.unit.utils import (
    ACCOUNT,
    ADDRESS1,
    BLOCK_NUMBER,
    CLAIM_ID,
    TARGET_CHAIN_ID,
    TIMESTAMP,
    make_claim_challenged,
    make_claim_unchallenged,
    make_context,
    make_request,
)
from beamer.tests.agent.utils import make_address, make_tx_hash
from beamer.tests.constants import FILL_ID
from beamer.typing import ClaimId, FillId, Termination


def test_handle_fill_hash_invalidated():
    context, config = make_context()

    request = make_request()
    request.fill(config.account.address, b"", FILL_ID, TIMESTAMP)
    context.requests.add(request.id, request)
    assert request.fill_id is not None

    claim_1 = make_claim_unchallenged(
        request=request, claimer=config.account.address, fill_id=request.fill_id
    )
    claim_1.start_challenge()
    claim_2 = make_claim_unchallenged(
        request=request,
        claim_id=ClaimId(claim_1.id + 1),
        claimer=config.account.address,
        fill_id=FillId(b"c0ffee"),
    )
    claim_2.start_challenge()
    context.claims.add(claim_1.id, claim_1)
    context.claims.add(claim_2.id, claim_2)

    fill_hash = request.fill_hash_with_fill_id(request.fill_id)
    event = FillHashInvalidated(
        chain_id=request.target_chain_id,
        tx_hash=HexBytes(""),
        fill_hash=fill_hash,
        block_number=BLOCK_NUMBER,
    )
    assert process_event(event, context) == (True, None)

    # Check that a matching event invalidates the claim
    assert claim_1.is_invalidated_l1_resolved  # pylint:disable=no-member

    # Check that a non-matching event does not invalidate the claim
    assert claim_2.is_claimer_winning  # pylint:disable=no-member


def test_handle_hash_invalidated():
    context, config = make_context()

    request = make_request()
    request.fill(config.account.address, b"", FILL_ID, TIMESTAMP)
    context.requests.add(request.id, request)
    assert request.fill_id is not None

    claim = make_claim_unchallenged(
        request=request,
        claimer=config.account.address,
        fill_id=request.fill_id,
        stay_in_started_state=True,
    )
    context.claims.add(claim.id, claim)

    fill_hash = request.fill_hash_with_fill_id(request.fill_id)
    tx_hash = make_tx_hash()
    event = HashInvalidated(
        chain_id=request.target_chain_id,
        tx_hash=tx_hash,
        request_hash=request.request_hash,
        fill_id=request.fill_id,
        fill_hash=fill_hash,
        block_number=BLOCK_NUMBER,
    )
    assert process_event(event, context) == (True, None)

    # Check that the event changes the claim state
    assert claim.is_claimer_winning  # pylint:disable=no-member
    assert claim.invalidation_tx == tx_hash


@patch("beamer.chain._invalidate")
@pytest.mark.parametrize("fill_id", [FILL_ID, FillId(b"c0ffee")])
def test_maybe_invalidate_claim_wrong_fill_id(mocked_invalidate, fill_id):
    context, config = make_context()

    request = make_request(valid_until=int(time.time() * 2))
    request.fill(config.account.address, b"", FILL_ID, TIMESTAMP)
    context.requests.add(request.id, request)

    claim_event = make_claim_unchallenged(
        request=request,
        claimer=config.account.address,
        fill_id=fill_id,
    ).latest_claim_made
    process_event(claim_event, context)

    claim = context.claims.get(claim_event.claim_id)
    assert claim is not None

    assert claim.is_started
    process_claims(context)
    assert claim.is_claimer_winning
    # invalidate must only be called if the fill ids do not match
    assert mocked_invalidate.called == (fill_id != FILL_ID)


@patch("beamer.chain._invalidate")
def test_maybe_invalidate_claim_wrong_fill_id_but_in_back_off(mocked_invalidate):
    context, config = make_context()

    request = make_request()
    request.fill(config.account.address, b"", FILL_ID, TIMESTAMP)
    context.requests.add(request.id, request)

    claim_event = make_claim_unchallenged(
        request=request,
        claimer=config.account.address,
        fill_id=FillId(b"c0ffee"),
    ).latest_claim_made
    assert request.fill_id != claim_event.fill_id
    process_event(claim_event, context)

    claim = context.claims.get(claim_event.claim_id)
    assert claim is not None
    claim.challenge_back_off_timestamp = int(time.time() + 100)

    assert claim.is_started
    process_claims(context)
    assert not claim.is_claimer_winning
    assert not mocked_invalidate.called


@patch("beamer.chain._invalidate")
def test_maybe_invalidate_claim_wrong_fill_id_but_timed_out(mocked_invalidate):
    context, config = make_context()

    request = make_request(valid_until=int(time.time() / 2))
    request.fill(config.account.address, b"", FILL_ID, TIMESTAMP)
    context.requests.add(request.id, request)

    claim_event = make_claim_unchallenged(
        request=request, claimer=config.account.address, fill_id=FillId(b"c0ffee")
    ).latest_claim_made
    assert request.fill_id != claim_event.fill_id
    process_event(claim_event, context)

    claim = context.claims.get(claim_event.claim_id)
    assert claim is not None

    assert claim.is_started
    process_claims(context)
    assert claim.is_claimer_winning
    assert mocked_invalidate.called


@patch("beamer.chain._withdraw")
@pytest.mark.parametrize(
    "test_data",
    [
        (ACCOUNT.address, ADDRESS1, False),
        (ADDRESS1, ACCOUNT.address, True),
        (ADDRESS1, make_address(), False),
    ],
)
def test_maybe_withdraw_after_invalidation(mocked_withdraw, test_data):
    context, _ = make_context()

    request = make_request()
    context.requests.add(request.id, request)

    claimer = test_data[0]
    challenger = test_data[1]
    should_withdraw = test_data[2]

    claim = make_claim_challenged(
        request=request,
        claimer=claimer,
        challenger=challenger,
        # Claim should not be withdrawable yet
        termination=Termination(TIMESTAMP + 1),
    )
    context.claims.add(claim.id, claim)
    claim.start_challenge(make_tx_hash(), TIMESTAMP)
    claim.l1_invalidate()
    assert claim.is_invalidated_l1_resolved  # pylint:disable=no-member

    assert not mocked_withdraw.called

    process_claims(context)

    assert should_withdraw == mocked_withdraw.called


@pytest.mark.parametrize("timestamp", [TIMESTAMP, int(time.time())])
def test_handle_generate_l1_invalidation_event(timestamp):
    context, config = make_context()

    request = make_request()
    context.requests.add(request.id, request)

    claim = make_claim_challenged(
        request=request,
        claimer=config.account.address,
    )
    claim.start_challenge(make_tx_hash(), timestamp)
    context.claims.add(claim.id, claim)

    event = deepcopy(claim.latest_claim_made)
    flag, events = process_event(event, context)

    assert flag

    assert events == [
        InitiateL1InvalidationEvent(
            chain_id=TARGET_CHAIN_ID,
            claim_id=CLAIM_ID,
        )
    ]
