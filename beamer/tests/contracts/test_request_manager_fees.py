import ape
import pytest

from numpy.random import randint

from beamer.tests.constants import FILL_ID
from beamer.tests.util import (
    alloc_accounts,
    alloc_whitelisted_accounts,
    make_request,
    temp_fee_data,
)

# Using this makes sure that we get nonzero fees when making requests.
# Reflects minFeePPM, lpFeePPM, protocolFeePPM
_NONZERO_FEE_DATA = 300_000, 15_000, 14_000


def test_fee_split_works(request_manager, token, claim_stake, claim_period):
    (requester,) = alloc_accounts(1)
    (claimer,) = alloc_whitelisted_accounts(1, [request_manager])
    transfer_amount = 23_000_000

    request_manager.updateFees(*_NONZERO_FEE_DATA)
    request_id = make_request(
        request_manager,
        token,
        requester,
        requester,
        transfer_amount,
        fee_data="standard",
    )

    target_chain_id = ape.chain.chain_id

    lp_fee = request_manager.lpFee(target_chain_id, token.address, transfer_amount)
    assert lp_fee > 0

    protocol_fee = request_manager.protocolFee(transfer_amount)
    assert protocol_fee > 0

    assert lp_fee + protocol_fee == request_manager.totalFee(
        target_chain_id, token.address, transfer_amount
    )

    # The request is not claimed yet, so no beamer fee has been collected yet
    assert request_manager.tokens(token).collectedProtocolFees == 0
    assert request_manager.requests(request_id).lpFee == lp_fee
    assert request_manager.requests(request_id).protocolFee == protocol_fee

    claim_tx = request_manager.claimRequest(request_id, FILL_ID, value=claim_stake, sender=claimer)
    claim_id = claim_tx.return_value

    # Update fees, which should not have any effect on the fee amounts that
    # were computed when the request was made.
    request_manager.updateFees(200_000, 145_000, 21_000)

    # Timetravel after claim period
    ape.chain.mine(deltatime=claim_period)

    withdraw_tx = request_manager.withdraw(claim_id, sender=claimer)
    assert withdraw_tx.events.filter(request_manager.ClaimStakeWithdrawn)
    assert request_manager.tokens(token).collectedProtocolFees == protocol_fee
    assert token.balanceOf(request_manager) == protocol_fee
    assert token.balanceOf(claimer) == transfer_amount + lp_fee


def test_protocol_fee_is_zero(request_manager):
    # For the time being, the protocol fee percentage should be zero.
    assert request_manager.protocolFeePPM() == 0
    assert request_manager.protocolFee(23_000_000) == 0


def test_protocol_fee_withdrawable_by_owner(
    deployer, request_manager, token, claim_stake, claim_period
):
    owner = deployer
    (requester,) = alloc_accounts(1)
    (claimer,) = alloc_whitelisted_accounts(1, [request_manager])
    amount = 23_000_000
    request_id = make_request(
        request_manager,
        token,
        requester,
        requester,
        amount,
        fee_data=_NONZERO_FEE_DATA,
    )
    protocol_fee = request_manager.requests(request_id).protocolFee

    with ape.reverts("Ownable: caller is not the owner"):
        request_manager.withdrawProtocolFees(token, requester, sender=requester)

    with ape.reverts("Protocol fee is zero"):
        request_manager.withdrawProtocolFees(token, owner)

    claim_tx = request_manager.claimRequest(request_id, FILL_ID, sender=claimer, value=claim_stake)
    claim_id = claim_tx.return_value

    ape.chain.mine(deltatime=claim_period)

    with ape.reverts("Protocol fee is zero"):
        request_manager.withdrawProtocolFees(token, owner)

    request_manager.withdraw(claim_id, sender=claimer)

    owner_token = token.balanceOf(owner)
    request_manager.withdrawProtocolFees(token.address, owner)
    assert token.balanceOf(owner) == owner_token + protocol_fee


def test_fee_data_updatable_by_owner(request_manager):
    (requester,) = alloc_accounts(1)

    with ape.reverts("Ownable: caller is not the owner"):
        request_manager.updateFees(
            *_NONZERO_FEE_DATA,
            sender=requester,
        )

    request_manager.updateFees(*_NONZERO_FEE_DATA)

    assert request_manager.minFeePPM() == _NONZERO_FEE_DATA[0]
    assert request_manager.lpFeePPM() == _NONZERO_FEE_DATA[1]
    assert request_manager.protocolFeePPM() == _NONZERO_FEE_DATA[2]


def test_fee_reimbursed_on_expiration(request_manager, token):
    (requester,) = alloc_accounts(1)
    transfer_amount = 23_000_000
    validity_period = request_manager.MIN_VALIDITY_PERIOD()

    request_manager.updateFees(*_NONZERO_FEE_DATA)
    request_id = make_request(
        request_manager,
        token,
        requester,
        requester,
        transfer_amount,
        fee_data="standard",
        validity_period=validity_period,
    )

    target_chain_id = ape.chain.chain_id

    total_fee = request_manager.totalFee(target_chain_id, token.address, transfer_amount)
    assert total_fee > 0

    # Timetravel after validity period
    ape.chain.mine(deltatime=validity_period)

    request_manager.withdrawExpiredRequest(request_id, sender=requester)
    assert token.balanceOf(requester) == transfer_amount + total_fee


@pytest.mark.parametrize("lp_fee_ppm", [1000])
def test_insufficient_lp_fee(request_manager, token):
    (requester,) = alloc_accounts(1)
    amount = 23_000_000
    validity_period = request_manager.MIN_VALIDITY_PERIOD()
    target_chain_id = ape.chain.chain_id

    assert request_manager.lpFee(target_chain_id, token.address, amount) > 0
    with ape.accounts.test_accounts.use_sender(requester):
        token.mint(requester, amount)

        # Approve just the amount, ignoring the LP fee and the protocol fee.
        # This must cause createRequest to fail.
        token.approve(request_manager.address, amount)

        with ape.reverts("Insufficient allowance"):
            request_manager.createRequest(
                ape.chain.chain_id,
                token.address,
                token.address,
                requester,
                amount,
                validity_period,
            )


def test_different_fees(request_manager, token, claim_period, claim_stake):
    (requester,) = alloc_accounts(1)
    (claimer,) = alloc_whitelisted_accounts(1, [request_manager])
    amount = int(9e18)

    fee_data_1 = 300_000, 8_000, 7_000
    fee_data_2 = 300_000, 4_000, 31_000
    target_chain_id = ape.chain.chain_id

    with ape.accounts.test_accounts.use_sender(requester):
        token.mint(requester, amount * 10)
        token.approve(request_manager.address, 2**256 - 1)

    with temp_fee_data(request_manager, *fee_data_1):
        request_id_1 = make_request(
            request_manager, token, requester, requester, amount, fee_data="standard"
        )
        lp_fee_1 = request_manager.lpFee(target_chain_id, token.address, amount)
        protocol_fee_1 = request_manager.protocolFee(amount)
        assert lp_fee_1 == 72e15
        assert protocol_fee_1 == 63e15

    with temp_fee_data(request_manager, *fee_data_2):
        request_id_2 = make_request(
            request_manager, token, requester, requester, amount, fee_data="standard"
        )
        lp_fee_2 = request_manager.lpFee(target_chain_id, token.address, amount)
        protocol_fee_2 = request_manager.protocolFee(amount)

        assert lp_fee_2 == 36e15
        assert protocol_fee_2 == 279e15

    assert (
        token.balanceOf(request_manager)
        == amount * 2 + protocol_fee_1 + protocol_fee_2 + lp_fee_1 + lp_fee_2
    )
    with ape.accounts.test_accounts.use_sender(claimer):
        claim_id_1 = request_manager.claimRequest(
            request_id_1, FILL_ID, value=claim_stake
        ).return_value
        claim_id_2 = request_manager.claimRequest(
            request_id_2, FILL_ID, value=claim_stake
        ).return_value

        ape.chain.mine(deltatime=claim_period)

        withdraw_tx = request_manager.withdraw(claim_id_1)
        assert withdraw_tx.events.filter(request_manager.ClaimStakeWithdrawn)
        assert request_manager.tokens(token).collectedProtocolFees == protocol_fee_1
        assert (
            token.balanceOf(request_manager) == amount + protocol_fee_1 + protocol_fee_2 + lp_fee_2
        )
        assert token.balanceOf(claimer) == amount + lp_fee_1

        withdraw_tx = request_manager.withdraw(claim_id_2)
        assert withdraw_tx.events.filter(request_manager.ClaimStakeWithdrawn)

    assert request_manager.tokens(token).collectedProtocolFees == protocol_fee_1 + protocol_fee_2
    assert token.balanceOf(request_manager) == protocol_fee_1 + protocol_fee_2
    assert token.balanceOf(claimer) == amount * 2 + lp_fee_1 + lp_fee_2


def test_ppm_out_of_bound(request_manager):
    ppm = 999_999

    request_manager.updateFees(0, ppm, ppm)

    ppm = 1_000_000

    with ape.reverts("Maximum PPM of 999999 exceeded"):
        request_manager.updateFees(0, ppm, 0)

    with ape.reverts("Maximum PPM of 999999 exceeded"):
        request_manager.updateFees(0, 0, ppm)


@pytest.mark.parametrize("transfer_cost", [int(400e12)])
def test_min_lp_fee(request_manager, token, chain_params, min_fee_ppm, token_params):
    target_chain_params = chain_params[0], int(3e12), 750_000
    request_manager.updateChain(999, *target_chain_params)

    source_chain_cost = (1_000_000 - chain_params[2]) * chain_params[1]
    target_chain_cost = target_chain_params[2] * target_chain_params[1]
    min_lp_fee = (
        (source_chain_cost + target_chain_cost)
        * token_params[1]
        * (1_000_000 + min_fee_ppm)
        / 1e30
    )

    assert min_lp_fee == request_manager.minLpFee(999, token.address)


@pytest.mark.parametrize("transfer_cost", [int(400e12)])
@pytest.mark.parametrize("lp_fee_ppm", [1000])
def test_lp_fee(request_manager, token):
    chain_id = ape.chain.chain_id
    min_lp_fee = request_manager.minLpFee(chain_id, token.address)
    lp_fee_ppm = request_manager.lpFeePPM()
    conjunction_amount = min_lp_fee * 1_000_000 // lp_fee_ppm
    lp_fee_take_off = 1_000_000 // lp_fee_ppm

    test_values = [
        (1, True),
        (conjunction_amount - 1, True),
        (conjunction_amount, True),
        (conjunction_amount + 1, True),
        (conjunction_amount + lp_fee_take_off - 1, True),
        (conjunction_amount + lp_fee_take_off, False),
        (conjunction_amount * 10, False),
    ]

    for test_amount, is_min_lp_fee in test_values:
        calculated_fee = request_manager.lpFee(chain_id, token.address, test_amount)

        if is_min_lp_fee:
            expected_fee = min_lp_fee
        else:
            expected_fee = test_amount * lp_fee_ppm // 1_000_000
            assert calculated_fee > min_lp_fee

        assert calculated_fee == expected_fee


@pytest.mark.parametrize("transfer_cost", [int(400e12)])
@pytest.mark.parametrize("lp_fee_ppm", [1000])
@pytest.mark.parametrize("protocol_fee_ppm", [1000])
def test_total_fee(request_manager, token, chain_params):
    target_chain_params = chain_params[0], int(3e12), 750_000
    request_manager.updateChain(999, *target_chain_params)

    min_lp_fee = request_manager.minLpFee(999, token.address)
    # find the value where lpFee == minLpFee to test with values lower and higher
    conjunction_amount = min_lp_fee * 1_000_000 // request_manager.lpFeePPM()

    assert min_lp_fee == request_manager.lpFee(999, token.address, conjunction_amount)

    test_amounts = [conjunction_amount // 2, conjunction_amount, conjunction_amount * 2]

    for amount in test_amounts:
        assert request_manager.totalFee(999, token.address, amount) == request_manager.lpFee(
            999, token.address, amount
        ) + request_manager.protocolFee(amount)


@pytest.mark.parametrize("transfer_cost", [int(400e12)])
@pytest.mark.parametrize("lp_fee_ppm", [1000])
@pytest.mark.parametrize("protocol_fee_ppm", [1000])
def test_transferable_amount(request_manager, token, chain_params):
    target_chain_params = chain_params[0], int(300e12), 750_000
    target_chain_id = 999
    request_manager.updateChain(target_chain_id, *target_chain_params)

    min_lp_fee = request_manager.minLpFee(target_chain_id, token.address)
    # find the value where lpFee == minLpFee to test with values lower and higher
    conjunction_amount = min_lp_fee * 1_000_000 // request_manager.lpFeePPM()

    test_amounts = [
        conjunction_amount // 2,
        conjunction_amount,
        conjunction_amount * 2,
        randint(1, 2**63),
    ]

    for transferable_amount in test_amounts:
        total_amount = transferable_amount + request_manager.totalFee(
            target_chain_id, token.address, transferable_amount
        )
        calculated_transferable_amount = request_manager.transferableAmount(
            target_chain_id, token.address, total_amount
        )
        # FIXME: There is a possible off by one error due to the absence
        #  of rounding in the contracts
        assert calculated_transferable_amount in [transferable_amount, transferable_amount - 1]
