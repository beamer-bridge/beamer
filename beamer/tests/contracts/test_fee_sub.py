import ape
from hexbytes import HexBytes
from web3.constants import ADDRESS_ZERO

from beamer.tests.util import (
    alloc_accounts,
    alloc_whitelisted_accounts,
    make_address,
    make_request,
)


def test_fee_sub(fee_sub, token, request_manager):
    mint_amount = 5
    sent_amount = 2
    chain_id = ape.chain.chain_id
    (sender, target) = alloc_accounts(2)

    wrong_token_address = make_address()

    total_fee = request_manager.totalFee(chain_id, token.address, sent_amount)
    old_contract_balance = token.balanceOf(fee_sub.address)

    with ape.reverts("Token not to be subsidized"):
        fee_sub.createRequest(
            chain_id,
            wrong_token_address,
            wrong_token_address,
            target,
            sent_amount,
            1800,
            sender=sender,
        )

    with ape.reverts("Transfer amount too small to be subsidized"):
        fee_sub.createRequest(
            chain_id, token.address, token.address, target, 1, 1800, sender=sender
        )

    token.mint(sender, mint_amount, sender=sender)

    with ape.reverts("Insufficient allowance"):
        fee_sub.createRequest(
            chain_id, token.address, token.address, target, 2, 1800, sender=sender
        )

    token.approve(fee_sub.address, mint_amount, sender=sender)

    assert token.balanceOf(sender) == mint_amount

    request = fee_sub.createRequest(
        chain_id, token.address, token.address, target, sent_amount, 1800, sender=sender
    )

    request_id = request.return_value

    assert token.balanceOf(sender) == mint_amount - sent_amount  # no fee
    assert token.balanceOf(fee_sub.address) == old_contract_balance - total_fee
    assert (
        request_manager.requests(request_id).sender == fee_sub.address
    )  # sender is fee sub contract


def test_expired_request_withdraw(fee_sub, token):
    mint_amount = 5
    sent_amount = 2
    chain_id = ape.chain.chain_id
    (sender, target) = alloc_accounts(2)

    token.mint(sender, mint_amount, sender=sender)
    token.approve(fee_sub.address, mint_amount, sender=sender)

    request = fee_sub.createRequest(
        chain_id, token.address, token.address, target, sent_amount, 1800, sender=sender
    )

    request_id = request.return_value

    assert token.balanceOf(sender) == mint_amount - sent_amount

    ape.chain.mine(deltatime=1800)

    assert fee_sub.senders(request_id) == sender

    fee_sub.withdrawExpiredRequest(request_id)

    assert fee_sub.senders(request_id) == ADDRESS_ZERO
    assert token.balanceOf(sender) == mint_amount

    with ape.reverts("Already refunded to the sender"):
        fee_sub.withdrawExpiredRequest(request_id)


def test_invalid_withdrawal(fee_sub, token, request_manager):
    (sender, target) = alloc_accounts(2)
    request_id = make_request(request_manager, token, sender, target, 1)
    with ape.reverts("Request was not created by this contract"):
        fee_sub.withdrawExpiredRequest(request_id)


def test_withdrawn_by_agent(fee_sub, token, request_manager, l1_messenger, claim_stake):
    mint_amount = 5
    sent_amount = 2
    chain_id = ape.chain.chain_id
    (sender, target) = alloc_accounts(2)
    (claimer,) = alloc_whitelisted_accounts(1, [request_manager])

    token.mint(sender, mint_amount, sender=sender)
    token.approve(fee_sub.address, mint_amount, sender=sender)

    request = fee_sub.createRequest(
        chain_id, token.address, token.address, target, sent_amount, 1800, sender=sender
    )

    request_id = request.return_value

    # Claim
    fill_id = HexBytes(b"123")
    claim_tx = request_manager.claimRequest(request_id, fill_id, sender=claimer, value=claim_stake)
    claim_id = claim_tx.return_value

    request_manager.invalidateFill(request_id, fill_id, chain_id, sender=l1_messenger)

    ape.chain.mine(deltatime=1800)

    request_manager.resolveRequest(request_id, fill_id, chain_id, claimer, sender=l1_messenger)

    request_manager.withdraw(claim_id, sender=claimer)

    with ape.reverts("Request was withdrawn by another address"):
        fee_sub.withdrawExpiredRequest(request_id)


def test_withdrawn_from_request_manager(fee_sub, token, request_manager):
    mint_amount = 5
    sent_amount = 2
    chain_id = ape.chain.chain_id
    (sender, target) = alloc_accounts(2)

    token.mint(sender, mint_amount, sender=sender)
    token.approve(fee_sub.address, mint_amount, sender=sender)

    request = fee_sub.createRequest(
        chain_id, token.address, token.address, target, sent_amount, 1800, sender=sender
    )

    request_id = request.return_value

    ape.chain.mine(deltatime=1800)

    request_manager.withdrawExpiredRequest(request_id)

    fee_sub.withdrawExpiredRequest(request_id)

    assert fee_sub.senders(request_id) == ADDRESS_ZERO


def test_amount_can_be_subsidized(fee_sub, token, request_manager):
    transfer_amount = 95_000_000
    token_address = token.address
    target_chain_id = ape.chain.chain_id

    # token subsidy is not activated for the token address
    fee_sub.setMinimumAmount(token.address, 0)
    can_be_subsidized = fee_sub.tokenAmountCanBeSubsidized(
        target_chain_id, token_address, transfer_amount
    )
    assert can_be_subsidized is False

    # transfer_amount is lower than the defined minimumAmount threshold
    fee_sub.setMinimumAmount(token.address, 95_000_001)
    can_be_subsidized = fee_sub.tokenAmountCanBeSubsidized(
        target_chain_id, token_address, transfer_amount
    )
    assert can_be_subsidized is False

    # fee amount is higher than the contracts token balance
    fee_sub.setMinimumAmount(token.address, 95_000_000)
    request_manager.updateFees(300_000, 15_000, 14_000)
    can_be_subsidized = fee_sub.tokenAmountCanBeSubsidized(
        target_chain_id, token_address, transfer_amount
    )
    assert can_be_subsidized is False

    token.transfer(fee_sub.address, 100_000_000)
    can_be_subsidized = fee_sub.tokenAmountCanBeSubsidized(
        target_chain_id, token_address, transfer_amount
    )
    assert can_be_subsidized is True


def test_enable_disable_token(fee_sub, deployer, request_manager):
    token2 = deployer.deploy(ape.project.MintableToken, request_manager.address)
    fee_sub.setMinimumAmount(token2.address, 5)
    assert token2.allowance(fee_sub.address, request_manager.address) == 2**256 - 1
    fee_sub.setMinimumAmount(token2.address, 0)
    assert token2.allowance(fee_sub.address, request_manager.address) == 0
