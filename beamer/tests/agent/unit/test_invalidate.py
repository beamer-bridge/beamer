from hexbytes import HexBytes

from beamer.events import FillHashInvalidated
from beamer.state_machine import process_event
from beamer.tests.agent.unit.utils import FILL_ID, make_claim, make_context, make_request
from beamer.typing import ClaimId, FillId


def test_handle_fill_hash_invalidated():
    context, config = make_context()

    request = make_request()
    request.fill(config.account.address, b"", FILL_ID)
    context.requests.add(request.id, request)
    assert request.fill_id is not None

    claim_1 = make_claim(request=request, claimer=config.account.address, fill_id=request.fill_id)
    claim_2 = make_claim(
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
        request_id=request.id,
        fill_hash=fill_hash,
    )
    assert process_event(event, context) == (True, None)

    # Check that a matching event invalidates the claim
    assert claim_1.is_invalidated  # pylint:disable=no-member

    # Check that a unmatching event does not invalidate the claim
    assert not claim_2.is_invalidated  # pylint:disable=no-member
