from copy import deepcopy
from unittest.mock import MagicMock, patch

import pytest
from hexbytes import HexBytes
from web3.types import ChecksumAddress, Wei

from beamer.chain import claim_request, process_claims, process_requests
from beamer.events import (
    ClaimMade,
    InitiateL1ResolutionEvent,
    RequestCreated,
    RequestFilled,
    RequestResolved,
)
from beamer.state_machine import process_event
from beamer.tests.agent.unit.utils import (
    ACCOUNT,
    ADDRESS1,
    BLOCK_NUMBER,
    CLAIM_ID,
    CLAIMER_STAKE,
    NULL_ADDRESS,
    REQUEST_ID,
    SOURCE_CHAIN_ID,
    TARGET_CHAIN_ID,
    TERMINATION,
    TIMESTAMP,
    make_claim_challenged,
    make_claim_unchallenged,
    make_context,
    make_request,
)
from beamer.tests.agent.utils import make_address, make_tx_hash
from beamer.tests.constants import FILL_ID
from beamer.typing import FillId, Termination, TokenAmount


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
    request.fill(config.account.address, b"", b"", TIMESTAMP)
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
    request.fill(config.account.address, b"", b"", TIMESTAMP)
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


def test_handle_request_resolved():
    context, config = make_context()
    filler = make_address()
    fill_id = FILL_ID

    # Must store the result in the request
    request = make_request()
    request.fill(config.account.address, b"", fill_id, TIMESTAMP)
    request.try_to_claim()

    event = RequestResolved(
        chain_id=TARGET_CHAIN_ID,
        tx_hash=HexBytes(""),
        request_hash=request.request_hash,
        filler=filler,
        fill_id=fill_id,
        block_number=BLOCK_NUMBER,
    )

    # Without a request, we simply drop the event
    assert process_event(event, context) == (True, None)

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
    request.fill(config.account.address, b"", b"", TIMESTAMP)
    context.requests.add(request.id, request)

    claim = make_claim_challenged(
        request=request,
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
    request.fill(config.account.address, b"", b"", TIMESTAMP)
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


@patch("beamer.chain._withdraw")
@pytest.mark.parametrize("termination", [TIMESTAMP - 1, TIMESTAMP])
@pytest.mark.parametrize("l1_filler", [ACCOUNT.address, make_address()])
@pytest.mark.parametrize("l1_fill_id", [FILL_ID, FillId(b"wrong fill id")])
def test_maybe_claim_l1_as_claimer(
    mocked_withdraw, termination: Termination, l1_filler: ChecksumAddress, l1_fill_id: FillId
):
    context, config = make_context()
    # Assert that ACCOUNT.address is the agent's address
    # Is used as an assurance that in case ACCOUNT is changed
    assert config.account.address == ACCOUNT.address

    request = make_request()
    request.fill(config.account.address, b"", b"", TIMESTAMP)
    request.l1_resolve(l1_filler, l1_fill_id)
    context.requests.add(request.id, request)

    claim = make_claim_challenged(
        request=request, claimer=config.account.address, fill_id=FILL_ID, termination=termination
    )
    context.claims.add(claim.id, claim)

    assert not claim.transaction_pending
    process_claims(context)

    # If agent is the correct filler, `withdraw` should be called, otherwise not
    if l1_filler == context.address and l1_fill_id == FILL_ID:
        assert mocked_withdraw.called
    else:
        assert not mocked_withdraw.called


@patch("beamer.chain._withdraw")
@pytest.mark.parametrize("termination", [TIMESTAMP - 1, TIMESTAMP])
@pytest.mark.parametrize("l1_filler", [ADDRESS1, make_address()])
@pytest.mark.parametrize("l1_fill_id", [FILL_ID, FillId(b"wrong fill id")])
def test_maybe_claim_l1_as_challenger(
    mocked_withdraw, termination: Termination, l1_filler: ChecksumAddress, l1_fill_id: FillId
):
    context, config = make_context()
    # Assert that ACCOUNT.address is the agent's address
    # Is used as an assurance that in case ACCOUNT is changed
    assert config.account.address == ACCOUNT.address
    request = make_request()
    request.fill(ADDRESS1, b"", b"", TIMESTAMP)
    request.l1_resolve(l1_filler, l1_fill_id)

    context.requests.add(request.id, request)

    claim = make_claim_challenged(
        request=request,
        claimer=ADDRESS1,
        challenger=config.account.address,
        fill_id=FILL_ID,
        termination=termination,
    )
    context.claims.add(claim.id, claim)

    assert not claim.transaction_pending
    process_claims(context)

    # If agent is the challenger and the claimer cheated,
    # `withdraw` should be called, otherwise not
    if l1_filler != ADDRESS1 or l1_fill_id != FILL_ID:
        assert mocked_withdraw.called
    else:
        assert not mocked_withdraw.called


@patch("beamer.metrics")
def test_handling_claim_during_sync(_mocked_metrics):
    """
    Tests the problem encountered in https://github.com/beamer-bridge/beamer/issues/782
    """
    context, config = make_context()

    source_token = make_address()
    target_token = make_address()
    filler = make_address()
    amount = TokenAmount(123456)

    request_event = RequestCreated(
        chain_id=SOURCE_CHAIN_ID,
        block_number=BLOCK_NUMBER,
        tx_hash=make_tx_hash(),
        request_id=REQUEST_ID,
        target_chain_id=TARGET_CHAIN_ID,
        source_token_address=source_token,
        target_token_address=target_token,
        target_address=make_address(),
        amount=amount,
        valid_until=TERMINATION,
    )
    claim_event = ClaimMade(
        chain_id=SOURCE_CHAIN_ID,
        block_number=BLOCK_NUMBER,
        tx_hash=make_tx_hash(),
        claim_id=CLAIM_ID,
        request_id=REQUEST_ID,
        fill_id=FILL_ID,
        claimer=config.account.address,
        claimer_stake=Wei(1_000),
        last_challenger=NULL_ADDRESS,
        challenger_stake_total=Wei(0),
        termination=TERMINATION,
    )
    fill_event = RequestFilled(
        chain_id=TARGET_CHAIN_ID,
        block_number=BLOCK_NUMBER,
        tx_hash=make_tx_hash(),
        request_id=REQUEST_ID,
        fill_id=FILL_ID,
        source_chain_id=SOURCE_CHAIN_ID,
        target_token_address=target_token,
        filler=filler,
        amount=amount,
    )

    context.match_checker = MagicMock()
    context.match_checker.is_valid_pair.return_value = True

    process_event(request_event, context)
    process_event(claim_event, context)
    process_event(fill_event, context)

    request = context.requests.get(REQUEST_ID)
    assert request is not None

    # Before the fix, the claim event didn't change the requests state. So it
    # remained in the pending state, which led to another try to claim the request
    assert request.is_claimed

    # It's also important that the fill information is still correctly attached to the
    # request, even if it's received later
    assert request.filler == fill_event.filler
    assert request.fill_tx == fill_event.tx_hash
    assert request.fill_id == fill_event.fill_id
