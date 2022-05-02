from copy import deepcopy
from pathlib import Path
from typing import Tuple
from unittest.mock import MagicMock

import pytest
from eth_account import Account
from eth_typing import BlockNumber
from hexbytes import HexBytes
from web3.types import BlockData, ChecksumAddress, Timestamp, Wei

from beamer.chain import Context, claim_request, process_claims, process_requests
from beamer.config import Config
from beamer.events import ClaimMade, InitiateL1ResolutionEvent, RequestResolved
from beamer.models.claim import Claim
from beamer.models.request import Request
from beamer.state_machine import process_event
from beamer.tests.agent.utils import make_address
from beamer.tracker import Tracker
from beamer.typing import URL, ChainId, ClaimId, FillId, RequestId, Termination, TokenAmount
from beamer.util import TokenMatchChecker

SOURCE_CHAIN_ID = ChainId(2)
TARGET_CHAIN_ID = ChainId(3)

REQUEST_ID = RequestId(10)
CLAIM_ID = ClaimId(200)

CLAIMER_STAKE = Wei(10_000_000)
CHALLENGER_STAKE = Wei(5_000_000)
TERMINATION = Termination(1)
TIMESTAMP = Timestamp(457)

ACCOUNT = Account.from_key(0xB25C7DB31FEED9122727BF0939DC769A96564B2DE4C4726D035B36ECF1E5B364)

ADDRESS1 = make_address()


class MockEth:
    def __init__(self, chain_id):
        self.chain_id = chain_id

    wait_for_transaction_receipt = MagicMock()


class MockWeb3:
    def __init__(self, chain_id):
        self.eth = MockEth(chain_id=chain_id)


def make_request() -> Request:
    return Request(
        request_id=REQUEST_ID,
        source_chain_id=SOURCE_CHAIN_ID,
        target_chain_id=TARGET_CHAIN_ID,
        source_token_address=make_address(),
        target_token_address=make_address(),
        target_address=make_address(),
        amount=TokenAmount(123),
        valid_until=TIMESTAMP - 1,
    )


def make_claim(
    request: Request,
    claimer: ChecksumAddress = None,
    claimer_stake: Wei = CLAIMER_STAKE,
    challenger: ChecksumAddress = None,
    challenger_stake: Wei = CHALLENGER_STAKE,
    termination: Termination = TERMINATION,
) -> Claim:
    challenger = challenger or make_address()
    claim = Claim(
        claim_made=ClaimMade(
            chain_id=request.source_chain_id,
            tx_hash=HexBytes(b""),
            claim_id=CLAIM_ID,
            request_id=request.id,
            fill_id=FillId(456),
            claimer=claimer or make_address(),
            claimer_stake=claimer_stake,
            last_challenger=challenger,
            challenger_stake_total=challenger_stake,
            termination=termination,
        ),
        challenge_back_off_timestamp=123,
    )
    claim.add_challenger_stake(challenger, challenger_stake)
    return claim


def make_context() -> Tuple[Context, Config]:
    checker = TokenMatchChecker([])
    config = Config(
        account=ACCOUNT,
        deployment_info={},
        l1_rpc_url=URL(""),
        l2a_rpc_url=URL(""),
        l2b_rpc_url=URL(""),
        token_match_file=Path(),
        fill_wait_time=1,
        prometheus_metrics_port=None,
    )

    context = Context(
        requests=Tracker(),
        claims=Tracker(),
        request_manager=MagicMock(),
        fill_manager=MagicMock(),
        match_checker=checker,
        address=config.account.address,
        latest_blocks={
            SOURCE_CHAIN_ID: BlockData(
                {
                    "number": BlockNumber(42),
                    "timestamp": TIMESTAMP,
                }
            )
        },
        config=config,
        web3_l1=MagicMock(),
        resolution_pool=MagicMock(),
        l1_resolutions={},
    )

    return context, config


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

    claim = make_claim(request)

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

    claim = make_claim(request, claimer=config.account.address)
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

    event = RequestResolved(
        chain_id=TARGET_CHAIN_ID,
        tx_hash=HexBytes(""),
        request_id=REQUEST_ID,
        fill_hash="",
        filler=filler,
    )

    # Without a request, this must fail
    assert process_event(event, context) == (False, None)

    # Must store the result in the request
    request = make_request()
    request.fill(config.account.address, b"", b"")
    request.try_to_claim()
    context.requests.add(request.id, request)

    assert request.l1_resolution_filler is None
    assert process_event(event, context) == (True, None)
    assert request.l1_resolution_filler == filler


def test_handle_claim_made():
    context, config = make_context()

    request = make_request()
    request.fill(config.account.address, b"", b"")
    context.requests.add(request.id, request)

    claim = make_claim(request, claimer=config.account.address)
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
    claim = make_claim(
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
    claim = make_claim(
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
    claim = make_claim(
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

    claim = make_claim(request=request, claimer=config.account.address, termination=termination)
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

    claim = make_claim(
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
