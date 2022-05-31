from copy import deepcopy

import pytest
from hexbytes import HexBytes
from web3.types import ChecksumAddress, Wei

from beamer.chain import claim_request, process_claims, process_requests
from beamer.events import InitiateL1ResolutionEvent, RequestResolved
from beamer.state_machine import process_event
from beamer.tests.agent.unit.utils import (
    ACCOUNT,
    ADDRESS1,
    CLAIM_ID,
    CLAIMER_STAKE,
    FILL_ID,
    REQUEST_ID,
    TARGET_CHAIN_ID,
    TIMESTAMP,
    make_claim_challenged,
    make_claim_unchallenged,
    make_context,
    make_request,
)
from beamer.tests.agent.utils import make_address
from beamer.typing import Termination


def test_skip_not_self_filled():
    context, _ = make_context()
    request = make_request()

    context.requests.add(request.id, request)

    assert request.is_pending  # pylint:disable=no-member
    claim_request(request, context)
    assert request.is_pending  # pylint:disable=no-member


def test_ignore_expired():
    context, config = make_context()

    request = make_request()
    request.filler = config.account.address
    context.requests.add(request.id, request)

    assert request.is_pending  # pylint:disable=no-member
    claim_request(request, context)
    assert request.is_ignored  # pylint:disable=no-member


def test_request_garbage_collection_without_claim():
    context, config = make_context()

    request = make_request()
    request.fill(config.account.address, b"", b"")
    request.withdraw()

    context.requests.add(request.id, request)

    assert len(context.requests) == 1
    process_requests(context)
    assert len(context.requests) == 0

    request = make_request()
    request.ignore()
    context.requests.add(request.id, request)

    assert len(context.requests) == 1
    process_requests(context)
    assert len(context.requests) == 0


def test_request_garbage_collection_with_claim():
    context, config = make_context()

    request = make_request()
    request.fill(config.account.address, b"", b"")
    request.withdraw()

    claim = make_claim_challenged(request)

    context.requests.add(request.id, request)
    context.claims.add(claim.id, claim)

    assert len(context.requests) == 1
    assert len(context.claims) == 1

    # While the claim exists, the request is not removed
    process_claims(context)
    process_requests(context)
    assert len(context.requests) == 1
    assert len(context.claims) == 1

    claim.withdraw()

    # Once the claim is removed, the request is removed as well
    process_claims(context)
    process_requests(context)
    assert len(context.requests) == 0
    assert len(context.claims) == 0


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
    assert context.resolution_pool.submit.called  # type: ignore  # pylint:disable=no-member


def test_handle_request_resolved():
    context, config = make_context()
    filler = make_address()
    fill_id = FILL_ID

    # Must store the result in the request
    request = make_request()
    request.fill(config.account.address, b"", fill_id)
    request.try_to_claim()

    event = RequestResolved(
        chain_id=TARGET_CHAIN_ID,
        tx_hash=HexBytes(""),
        fill_hash=request.fill_hash_with_fill_id(fill_id),
        filler=filler,
    )

    # Without a request, this must fail
    assert process_event(event, context) == (False, None)

    # Adding the request and claim to context
    context.requests.add(request.id, request)
    claim = make_claim_unchallenged(request, fill_id=fill_id)
    context.claims.add(claim.id, claim)

    assert request.l1_resolution_filler is None
    assert process_event(event, context) == (True, None)
    assert request.l1_resolution_filler == filler


def test_handle_generate_l1_resolution_event():
    context, config = make_context()

    request = make_request()
    request.fill(config.account.address, b"", b"")
    context.requests.add(request.id, request)

    claim = make_claim_challenged(
        request,
        claimer=config.account.address,
        challenger=make_address(),
        challenger_stake=Wei(CLAIMER_STAKE + 1),
    )
    context.claims.add(claim.id, claim)

    event = deepcopy(claim.latest_claim_made)
    flag, events = process_event(event, context)

    assert flag
    assert events == [
        InitiateL1ResolutionEvent(
            chain_id=TARGET_CHAIN_ID,
            request_id=REQUEST_ID,
            claim_id=CLAIM_ID,
        )
    ]


def test_maybe_claim_no_l1():
    context, config = make_context()

    request = make_request()
    request.fill(config.account.address, b"", b"")
    context.requests.add(request.id, request)

    # Claimer doesn't win challenge game, `withdraw` must not be called
    claim = make_claim_challenged(
        request=request,
        claimer=config.account.address,
        claimer_stake=Wei(10),
        challenger_stake=Wei(50),
    )
    context.claims.add(claim.id, claim)

    # Make sure we're outside the challenge period
    block = context.latest_blocks[request.source_chain_id]
    assert block["timestamp"] >= claim.termination

    assert not claim.transaction_pending
    process_claims(context)
    assert not claim.transaction_pending

    # Claimer wins challenge game, `withdraw` must be called
    claim = make_claim_challenged(
        request=request,
        claimer=config.account.address,
        claimer_stake=Wei(100),
        challenger_stake=Wei(50),
    )
    context.claims.add(claim.id, claim)

    # Make sure we're outside the challenge period
    block = context.latest_blocks[request.source_chain_id]
    assert block["timestamp"] >= claim.termination

    assert not claim.transaction_pending
    process_claims(context)
    assert claim.transaction_pending

    # Claimer leads challenge game, but challenge period is not over
    block = context.latest_blocks[request.source_chain_id]
    claim = make_claim_challenged(
        request=request,
        claimer=config.account.address,
        claimer_stake=Wei(100),
        challenger_stake=Wei(50),
        termination=Termination(TIMESTAMP + 1),
    )
    context.claims.add(claim.id, claim)

    # Make sure we're inside the challenge period
    assert block["timestamp"] < claim.termination

    assert not claim.transaction_pending
    process_claims(context)
    assert not claim.transaction_pending


@pytest.mark.parametrize("termination", [TIMESTAMP - 1, TIMESTAMP])
@pytest.mark.parametrize("l1_filler", [ACCOUNT.address, make_address()])
def test_maybe_claim_l1_as_claimer(termination: Termination, l1_filler: ChecksumAddress):
    context, config = make_context()

    request = make_request()
    request.fill(config.account.address, b"", b"")
    request.l1_resolution_filler = l1_filler
    context.requests.add(request.id, request)

    claim = make_claim_challenged(
        request=request, claimer=config.account.address, termination=termination
    )
    context.claims.add(claim.id, claim)

    assert not claim.transaction_pending
    process_claims(context)

    # If agent is the filler, `withdraw` should be called, otherwise not
    if l1_filler == context.address:
        assert claim.transaction_pending
    else:
        assert not claim.transaction_pending


@pytest.mark.parametrize("termination", [TIMESTAMP - 1, TIMESTAMP])
@pytest.mark.parametrize("l1_filler", [ADDRESS1, make_address()])
def test_maybe_claim_l1_as_challenger(termination: Termination, l1_filler: ChecksumAddress):
    context, config = make_context()

    request = make_request()
    request.fill(ADDRESS1, b"", b"")
    request.l1_resolution_filler = l1_filler
    context.requests.add(request.id, request)

    claim = make_claim_challenged(
        request=request,
        claimer=ADDRESS1,
        challenger=config.account.address,
        termination=termination,
    )
    context.claims.add(claim.id, claim)

    assert not claim.transaction_pending
    process_claims(context)

    # If agent is the challenger and the claimer cheated,
    # `withdraw` should be called, otherwise not
    if l1_filler != ADDRESS1:
        assert claim.transaction_pending
    else:
        assert not claim.transaction_pending
