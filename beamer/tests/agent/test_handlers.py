from unittest.mock import MagicMock
from beamer.agent import Config
from beamer.chain import Context, claim_request
from beamer.request import Request, Tracker
from beamer.typing import ChainId, RequestId, TokenAmount
from beamer.util import TokenMatchChecker


class MockEth:
    def __init__(self, chain_id):
        self.chain_id = chain_id

    def get_block(self, _block_identifier):  # pylint: disable=unused-argument, no-self-use
        return {
            "number": 42,
            "timestamp": 457,
        }


class MockWeb3:
    def __init__(self, chain_id):
        self.eth = MockEth(chain_id=chain_id)


def make_request(token):
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


def make_context(config, request_manager=None):
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
