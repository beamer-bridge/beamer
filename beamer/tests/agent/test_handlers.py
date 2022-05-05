import random
import string
from copy import deepcopy
from unittest.mock import MagicMock

import pytest
from eth_typing import BlockNumber
from eth_utils import to_checksum_address
from hexbytes import HexBytes
from web3.contract import Contract
from web3.types import BlockData, ChecksumAddress, Timestamp, Wei

from beamer.chain import Context, claim_request, process_claims, process_requests
from beamer.config import Config
from beamer.events import ClaimMade, InitiateL1ResolutionEvent, RequestResolved
from beamer.models.claim import Claim
from beamer.models.request import Request
from beamer.state_machine import process_event
from beamer.tracker import Tracker
from beamer.typing import ChainId, ClaimId, FillId, RequestId, Termination, TokenAmount
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


def make_request(token) -> Request:
    return Request(
        request_id=REQUEST_ID,
        source_chain_id=SOURCE_CHAIN_ID,
        target_chain_id=TARGET_CHAIN_ID,
        source_token_address=token.address,
        target_token_address=token.address,
        target_address=token.address,
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


def make_context(config: Config, request_manager: Contract = None):
    if request_manager is None:
        request_manager = MagicMock()

    checker = TokenMatchChecker([])

    return Context(
        requests=Tracker(),
        claims=Tracker(),
        request_manager=request_manager,
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


def test_skip_not_self_filled(token, config: Config):
    request = make_request(token)
    context = make_context(config)

    context.requests.add(request.id, request)

    assert request.is_pending  # pylint:disable=no-member
    claim_request(request, context)
    assert request.is_pending  # pylint:disable=no-member


def test_ignore_expired(token, config: Config):
    request = make_request(token)
    request.filler = config.account.address

    context = make_context(config)
    context.requests.add(request.id, request)

    assert request.is_pending  # pylint:disable=no-member
    claim_request(request, context)
    assert request.is_ignored  # pylint:disable=no-member


def test_request_garbage_collection_without_claim(token, config: Config):
    request = make_request(token)
    request.fill(config.account.address, b"", b"")
    request.withdraw()

    context = make_context(config)
    context.requests.add(request.id, request)

    assert len(context.requests) == 1
    process_requests(context)
    assert len(context.requests) == 0

    request = make_request(token)
    request.ignore()
    context.requests.add(request.id, request)

    assert len(context.requests) == 1
    process_requests(context)
    assert len(context.requests) == 0


def test_request_garbage_collection_with_claim(token, config: Config):
    request = make_request(token)
    request.fill(config.account.address, b"", b"")
    request.withdraw()

    claim = make_claim(request)

    context = make_context(config)
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


def test_handle_initiate_l1_resolution(token: Contract, config: Config):
    request = make_request(token)

    context = make_context(config)
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
    context.web3_l1.eth.gas_price = 1
    request.fill(config.account.address, b"", b"")
    assert process_event(event, context) == (True, None)
    assert context.resolution_pool.submit.called  # pylint:disable=no-member


def test_handle_request_resolved(token: Contract, config: Config):
    context = make_context(config)
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
    request = make_request(token)
    context.requests.add(request.id, request)

    assert request.l1_resolution_filler is None
    assert process_event(event, context) == (True, None)
    assert request.l1_resolution_filler == filler


def test_handle_claim_made(token: Contract, config: Config):
    context = make_context(config)

    request = make_request(token)
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
