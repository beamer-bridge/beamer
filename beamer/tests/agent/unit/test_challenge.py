import pytest
from web3.types import Wei

from beamer.chain import process_claims
from beamer.tests.agent.unit.utils import (
    ADDRESS1,
    CLAIMER_STAKE,
    TIMESTAMP,
    make_claim_challenged,
    make_claim_unchallenged,
    make_context,
    make_request,
)
from beamer.tests.agent.utils import make_address
from beamer.tests.constants import FILL_ID
from beamer.typing import FillId, Termination


@pytest.mark.parametrize("fill_id", [FILL_ID, FillId(b"cafebabe")])
@pytest.mark.parametrize("filler", [ADDRESS1, make_address()])
def test_challenge_as_challenger(filler, fill_id):
    context, _ = make_context()

    request = make_request()
    context.requests.add(request.id, request)
    request.filler = ADDRESS1
    request.fill_id = FILL_ID
    claim = make_claim_unchallenged(
        request=request,
        claimer=filler,
        fill_id=fill_id,
        termination=Termination(TIMESTAMP + 1),
    )
    context.claims.add(claim.id, claim)

    assert not claim.transaction_pending
    process_claims(context)
    assert claim.valid_claim_for_request(request) != claim.transaction_pending


def test_challenge_as_claimer():
    context, _ = make_context()

    request = make_request()
    context.requests.add(request.id, request)
    request.filler = make_address()
    claim = make_claim_challenged(
        request=request,
        claimer=context.address,
        challenger=make_address(),
        challenger_stake=Wei(CLAIMER_STAKE + 1),
        termination=Termination(TIMESTAMP + 1),
    )
    context.claims.add(claim.id, claim)

    assert not claim.transaction_pending
    process_claims(context)
    assert claim.transaction_pending


@pytest.mark.parametrize("filler", [ADDRESS1, None])
def test_join_false_claim_challenge_only_when_unfilled(filler):

    context, _ = make_context()

    request = make_request()
    context.requests.add(request.id, request)
    request.filler = filler
    claim = make_claim_challenged(
        request=request,
        challenger=make_address(),
        termination=Termination(TIMESTAMP + 1),
    )
    context.claims.add(claim.id, claim)

    # Ensure that context is not part of challenge
    assert claim.claimer != context.address
    assert claim.get_challenger_stake(context.address) == 0
    assert claim.latest_claim_made.challenger_stake_total > 0

    process_claims(context)
    if request.filler is None:
        assert claim.transaction_pending
    else:
        assert not claim.transaction_pending
