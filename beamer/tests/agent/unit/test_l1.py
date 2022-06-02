import pytest
from web3.types import Wei

from beamer.events import InitiateL1InvalidationEvent, InitiateL1ResolutionEvent
from beamer.state_machine import process_event
from beamer.tests.agent.unit.utils import (
    CLAIM_ID,
    REQUEST_ID,
    TARGET_CHAIN_ID,
    make_claim_challenged,
    make_context,
    make_request,
)
from beamer.tests.agent.utils import make_tx_hash


def test_handle_initiate_l1_resolution():
    context, config = make_context()

    request = make_request()
    context.requests.add(request.id, request)

    event = InitiateL1ResolutionEvent(
        chain_id=TARGET_CHAIN_ID,
        request_id=REQUEST_ID,
        claim_id=CLAIM_ID,
    )

    # Without a claim, this must fail
    assert process_event(event, context) == (False, None)

    claim = make_claim_challenged(request, claimer=config.account.address)
    context.claims.add(claim.id, claim)

    # Must only be called if request is filled
    with pytest.raises(AssertionError, match="Request not yet filled"):
        process_event(event, context)

    # Check that task is added to resolution pool
    context.web3_l1.eth.gas_price = Wei(1)  # type: ignore
    request.fill(config.account.address, b"", b"")
    request.try_to_claim()
    assert process_event(event, context) == (True, None)
    assert context.task_pool.submit.called  # type: ignore  # pylint:disable=no-member


def test_handle_initiate_l1_invalidation():
    context, config = make_context()

    request = make_request()
    context.requests.add(request.id, request)

    event = InitiateL1InvalidationEvent(
        chain_id=TARGET_CHAIN_ID,
        claim_id=CLAIM_ID,
    )

    # Without a claim, this must fail
    assert process_event(event, context) == (False, None)

    claim = make_claim_challenged(request, claimer=config.account.address)
    context.claims.add(claim.id, claim)

    # Must only be called if claim is invalidated
    with pytest.raises(AssertionError, match="Claim not invalidated"):
        process_event(event, context)

    # Check that task is added to resolution pool
    context.web3_l1.eth.gas_price = Wei(1)  # type: ignore
    claim.start_challenge(make_tx_hash())
    assert process_event(event, context) == (True, None)
    assert context.task_pool.submit.called  # type: ignore  # pylint:disable=no-member
