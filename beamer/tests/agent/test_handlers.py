import random
import string
from unittest.mock import MagicMock

from eth_utils import to_checksum_address
from web3.contract import Contract
from web3.types import ChecksumAddress, Wei

from beamer.agent import Config
from beamer.chain import Context, claim_request, process_claims, process_requests
from beamer.events import ClaimMade
from beamer.models.claim import Claim
from beamer.models.request import Request
from beamer.tracker import Tracker
from beamer.typing import ChainId, ClaimId, FillId, RequestId, Termination, TokenAmount
from beamer.util import TokenMatchChecker


class MockEth:
    def __init__(self, chain_id):
        self.chain_id = chain_id

    def get_block(self, _block_identifier):  # pylint: disable=unused-argument, no-self-use
        return {
            "number": 42,
            "timestamp": 457,
        }

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
        request_id=RequestId(1),
        source_chain_id=ChainId(2),
        target_chain_id=ChainId(4),
        source_token_address=token.address,
        target_token_address=token.address,
        target_address=token.address,
        amount=TokenAmount(123),
        valid_until=456,
    )


def make_claim(request: Request) -> Claim:
    return Claim(
        claim_made=ClaimMade(
            chain_id=request.source_chain_id,
            claim_id=ClaimId(1),
            request_id=request.id,
            fill_id=FillId(456),
            claimer=request.filler or make_address(),
            claimer_stake=Wei(0),
            challenger=make_address(),
            challenger_stake=Wei(0),
            termination=Termination(1),
        ),
        challenge_back_off_timestamp=123,
    )


def make_context(config: Config, request_manager: Contract = None):
    if request_manager is None:
        request_manager = MagicMock()

    checker = TokenMatchChecker([])

    return Context(
        Tracker(), Tracker(), request_manager, MagicMock(), checker, 5, config.account.address
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

    request_manager = MagicMock(web3=MockWeb3(2))
    context = make_context(config, request_manager)
    context.requests.add(request.id, request)

    assert request.is_pending  # pylint:disable=no-member
    claim_request(request, context)
    assert request.is_ignored  # pylint:disable=no-member

    assert not request_manager.functions.called


def test_request_garbage_collection_without_claim(token, config: Config):
    request = make_request(token)
    request.fill(config.account.address, b"")
    request.withdraw()

    context = make_context(config)
    context.requests.add(request.id, request)

    assert len(context.requests) == 1
    process_requests(context)
    assert len(context.requests) == 0


def test_request_garbage_collection_with_claim(token, config: Config):
    request = make_request(token)
    request.fill(config.account.address, b"")
    request.withdraw()

    claim = make_claim(request)

    request_manager = MagicMock(web3=MockWeb3(2))
    context = make_context(config, request_manager=request_manager)
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
