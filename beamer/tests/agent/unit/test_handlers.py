from typing import cast
from unittest.mock import MagicMock, patch

import pytest
from eth_typing import BlockNumber, HexStr
from eth_utils import to_checksum_address
from hexbytes import HexBytes
from web3.constants import ADDRESS_ZERO
from web3.datastructures import AttributeDict
from web3.types import ChecksumAddress, TxReceipt, Wei

from beamer.agent.chain import claim_request, fill_request, process_claims, process_requests
from beamer.agent.state_machine import process_event
from beamer.events import RequestResolved
from beamer.tests.agent.unit.utils import (
    ACCOUNT,
    ADDRESS1,
    BLOCK_NUMBER,
    SOURCE_CHAIN_ID,
    TIMESTAMP,
    make_claim_challenged,
    make_claim_unchallenged,
    make_context,
    make_request,
)
from beamer.tests.agent.utils import make_address
from beamer.tests.constants import FILL_ID
from beamer.typing import FillId, Termination
from beamer.util import get_ERC20_abi


def get_tx_receipt(status, tx_hash) -> TxReceipt:
    data = {
        "status": status,
        "transactionHash": tx_hash,
        "blockHash": HexBytes(0),
        "blockNumber": BlockNumber(1),
        "contractAddress": None,
        "cumulativeGasUsed": 0,
        "effectiveGasPrice": 1,
        "gasUsed": Wei(1),
        "from": ADDRESS1,
        "logs": [],
        "logsBloom": HexBytes(0),
        "root": HexStr("1"),
        "to": ADDRESS1,
        "transactionIndex": 1,
    }
    return cast(TxReceipt, AttributeDict(data))


@pytest.mark.parametrize("claimable", [True, False])
def test_claim_after_expiry(claim_request_extension, claimable):
    context, config = make_context()
    valid_until = TIMESTAMP - claim_request_extension
    assert valid_until > 0

    if claimable:
        valid_until += 1

    request = make_request(valid_until)

    context.requests.add(request.id, request)
    request.filler = config.account.address
    request.try_to_fill()

    assert request.filled.is_active
    claim_request(request, context)
    if claimable:
        assert request.claimed.is_active
    else:
        assert request.ignored.is_active


# First request will be completed without any issue as expected
# Second request will be in pending for some time and when validity expires, it will be ignored.
# Second tx receipt status is indicating the failure
def test_fill_request_transaction_status():
    context, _ = make_context()
    request = make_request(TIMESTAMP + 2)

    context.requests.add(request.id, request)
    assert request.pending.is_active
    w3 = context.fill_manager.w3
    token_abi = get_ERC20_abi()
    token = w3.eth.contract(abi=token_abi, address=request.target_token_address)
    token.functions.balanceOf(w3.eth.default_account).call.return_value = 10000
    func = context.fill_manager.functions.fillRequest(
        sourceChainId=request.source_chain_id,
        targetTokenAddress=request.target_token_address,
        targetReceiverAddress=request.target_address,
        amount=request.amount,
        nonce=request.nonce,
    )
    func.transact.return_value = 1
    func_eth = func.w3.eth
    func_eth.wait_for_transaction_receipt.return_value = get_tx_receipt(1, HexBytes("0x1"))
    fill_request(request, context)
    assert request.filled.is_active

    context, _ = make_context()
    request = make_request(TIMESTAMP + 2)

    context.requests.add(request.id, request)
    w3 = context.fill_manager.w3
    token = w3.eth.contract(abi=token_abi, address=request.target_token_address)
    token.functions.balanceOf(w3.eth.default_account).call.return_value = 10000
    func = context.fill_manager.functions.fillRequest(
        sourceChainId=request.source_chain_id,
        targetTokenAddress=request.target_token_address,
        targetReceiverAddress=request.target_address,
        amount=request.amount,
        nonce=request.nonce,
    )

    func.transact.return_value = 2
    func_eth = func.w3.eth
    func_eth.wait_for_transaction_receipt.return_value = get_tx_receipt(0, HexBytes("0x0"))
    fill_request(request, context)
    assert request.pending.is_active


def test_skip_not_self_filled():
    context, _ = make_context()
    request = make_request()

    context.requests.add(request.id, request)

    assert request.pending.is_active
    claim_request(request, context)
    assert request.pending.is_active


def test_ignore_expired(claim_request_extension):
    context, config = make_context()
    valid_until = TIMESTAMP - claim_request_extension
    assert valid_until > 0
    request = make_request(valid_until=valid_until)
    request.filler = config.account.address
    context.requests.add(request.id, request)

    assert request.pending.is_active
    claim_request(request, context)
    assert request.ignored.is_active


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
    fill_tx = b"0xxxxxx"

    # Must store the result in the request
    request = make_request()
    request.fill(config.account.address, fill_tx, fill_id, TIMESTAMP)
    request.try_to_claim()

    event = RequestResolved(
        event_chain_id=SOURCE_CHAIN_ID,
        event_address=to_checksum_address(ADDRESS_ZERO),
        tx_hash=HexBytes(""),
        request_id=request.id,
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

    context.l1_resolutions[HexBytes(fill_tx)] = MagicMock()
    assert request.l1_resolution_filler is None
    assert process_event(event, context) == (True, None)
    assert request.l1_resolution_filler == filler


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


@patch("beamer.agent.chain._withdraw")
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


@patch("beamer.agent.chain._withdraw")
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
