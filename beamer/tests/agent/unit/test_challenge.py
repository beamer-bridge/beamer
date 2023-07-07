import time
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import MagicMock, patch

import pytest
from eth_typing import BlockNumber
from hexbytes import HexBytes
from web3.types import BlockData, Wei

from beamer.agent.agent import Chain
from beamer.agent.chain import process_claims
from beamer.tests.agent.unit.utils import (
    ADDRESS1,
    CLAIMER_STAKE,
    TIMESTAMP,
    MockWeb3,
    make_claim_challenged,
    make_claim_unchallenged,
    make_context,
    make_request,
)
from beamer.tests.agent.utils import make_address
from beamer.tests.constants import FILL_ID
from beamer.typing import ChainId, FillId, Termination


@pytest.mark.parametrize("fill_id", [FILL_ID, FillId(b"cafebabe")])
@pytest.mark.parametrize("filler", [ADDRESS1, make_address()])
def test_challenge_as_challenger(filler, fill_id):
    context, _ = make_context()

    request = make_request()
    context.requests.add(request.id, request)
    request.filler = ADDRESS1
    request.fill_id = FILL_ID
    request.fill_timestamp = TIMESTAMP
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
    request.fill_timestamp = TIMESTAMP
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
    request.fill_timestamp = TIMESTAMP
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


@patch("beamer.agent.chain.run_relayer_for_tx")
def test_optimism_prove(mocked_relayer_call):
    timestamp = int(time.time())
    mocked_relayer_call.return_value = str(timestamp)
    op_chain_id = ChainId(901)
    context, _ = make_context()
    context.latest_blocks[op_chain_id] = BlockData(
        {"number": BlockNumber(30), "timestamp": TIMESTAMP}
    )
    context.finality_periods[op_chain_id] = 1
    context.target_chain = Chain(
        MockWeb3(op_chain_id),  # type: ignore
        op_chain_id,
        "source",
        [],
        fill_manager=MagicMock(),
        request_manager=MagicMock(),
    )
    context.task_pool = ThreadPoolExecutor(max_workers=1)
    request = make_request()
    request.target_chain_id = op_chain_id
    context.requests.add(request.id, request)
    request.filler = make_address()
    request.fill_timestamp = TIMESTAMP
    request.fill_tx = HexBytes(make_address())
    claim = make_claim_challenged(
        request=request,
        claimer=context.address,
        challenger=make_address(),
        challenger_stake=Wei(CLAIMER_STAKE + 1),
        termination=Termination(TIMESTAMP + 1),
    )
    context.claims.add(claim.id, claim)
    process_claims(context)
    assert request.fill_tx in context.l1_resolutions
    assert request.fill_timestamp == timestamp
