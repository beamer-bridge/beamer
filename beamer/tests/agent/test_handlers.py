import random
import string
from copy import deepcopy
from pathlib import Path
from typing import Tuple
from unittest.mock import MagicMock

import pytest
from eth_account import Account
from eth_typing import BlockNumber
from eth_utils import to_checksum_address
from hexbytes import HexBytes
from web3.types import BlockData, ChecksumAddress, Timestamp, Wei

from beamer.chain import Context, claim_request, process_claims, process_requests
from beamer.config import Config
from beamer.events import ClaimMade, InitiateL1ResolutionEvent, RequestResolved
from beamer.models.claim import Claim
from beamer.models.request import Request
from beamer.state_machine import process_event
from beamer.tracker import Tracker
from beamer.typing import URL, ChainId, ClaimId, FillId, RequestId, Termination, TokenAmount
from beamer.util import TokenMatchChecker

SOURCE_CHAIN_ID = ChainId(2)
TARGET_CHAIN_ID = ChainId(3)

REQUEST_ID = RequestId(10)
CLAIM_ID = ClaimId(200)


class MockEth:
    def __init__(self, chain_id):
        self.chain_id = chain_id

    wait_for_transaction_receipt = MagicMock()


class MockWeb3:
    def __init__(self, chain_id):
        self.eth = MockEth(chain_id=chain_id)


def make_bytes(length: int) -> bytes:
    return bytes("".join(random.choice(string.printable) for _ in range(length)), encoding="utf-8")


def make_address() -> ChecksumAddress:
    return to_checksum_address(make_bytes(20))


def make_request() -> Request:
    return Request(
        request_id=REQUEST_ID,
        source_chain_id=SOURCE_CHAIN_ID,
        target_chain_id=TARGET_CHAIN_ID,
        source_token_address=make_address(),
        target_token_address=make_address(),
        target_address=make_address(),
        amount=TokenAmount(123),
        valid_until=456,
    )


def make_claim(request: Request, claimer: ChecksumAddress = None) -> Claim:
    return Claim(
        claim_made=ClaimMade(
            chain_id=request.source_chain_id,
            tx_hash=HexBytes(b""),
            claim_id=CLAIM_ID,
            request_id=request.id,
            fill_id=FillId(456),
            claimer=claimer or make_address(),
            claimer_stake=Wei(1_000_000),
            challenger=make_address(),
            challenger_stake=Wei(5_000_000),
            termination=Termination(1),
        ),
        challenge_back_off_timestamp=123,
    )


def make_context() -> Tuple[Context, Config]:
    checker = TokenMatchChecker([])
    config = Config(
        account=Account.from_key(
            0xB25C7DB31FEED9122727BF0939DC769A96564B2DE4C4726D035B36ECF1E5B364
        ),
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
                    "timestamp": Timestamp(457),
                }
            )
        },
        config=config,
        web3_l1=MagicMock(),
        resolution_pool=MagicMock(),
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
    assert process_event(event, context) == (True, None)
    assert context.resolution_pool.submit.called  # type: ignore  # pylint:disable=no-member


def test_handle_request_resolved():
    context, _ = make_context()
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

    event = deepcopy(claim._latest_claim_made)
    flag, events = process_event(event, context)

    assert flag
    assert events == [
        InitiateL1ResolutionEvent(
            chain_id=TARGET_CHAIN_ID,
            request_id=REQUEST_ID,
            claim_id=CLAIM_ID,
        )
    ]
