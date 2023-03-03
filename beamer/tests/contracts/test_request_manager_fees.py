import ape

from beamer.tests.constants import (
    FILL_ID,
    RM_R_FIELD_LP_FEE,
    RM_R_FIELD_PROTOCOL_FEE,
    RM_T_FIELD_COLLECTED_PROTOCOL_FEES,
    RM_T_FIELD_PROTOCOL_FEE_PPM,
)
from beamer.tests.util import (
    alloc_accounts,
    alloc_whitelisted_accounts,
    make_request,
    temp_fee_data,
    update_token,
)

# Using this makes sure that we get nonzero fees when making requests.
_NONZERO_FEE_DATA = dict(min_lp_fee=int(5e8), lp_fee_ppm=15_000, protocol_fee_ppm=14_000)


def test_fee_split_works(request_manager, token, claim_stake, claim_period):
    (requester,) = alloc_accounts(1)
    (claimer,) = alloc_whitelisted_accounts(1, [request_manager])
    transfer_amount = 23_000_000

    update_token(request_manager, token, _NONZERO_FEE_DATA)
    request_id = make_request(
        request_manager,
        token,
        requester,
        requester,
        transfer_amount,
        fee_data="standard",
    )

    lp_fee = request_manager.lpFee(token.address, transfer_amount)
    assert lp_fee > 0

    protocol_fee = request_manager.protocolFee(token.address, transfer_amount)
    assert protocol_fee > 0

    assert lp_fee + protocol_fee == request_manager.totalFee(token.address, transfer_amount)

    # The request is not claimed yet, so no beamer fee has been collected yet
    assert request_manager.tokens(token)[RM_T_FIELD_COLLECTED_PROTOCOL_FEES] == 0
    assert request_manager.requests(request_id)[RM_R_FIELD_LP_FEE] == lp_fee
    assert request_manager.requests(request_id)[RM_R_FIELD_PROTOCOL_FEE] == protocol_fee

    claim_tx = request_manager.claimRequest(request_id, FILL_ID, value=claim_stake, sender=claimer)
    claim_id = claim_tx.return_value

    # Update fees, which should not have any effect on the fee amounts that
    # were computed when the request was made.
    update_token(
        request_manager,
        token,
        dict(min_lp_fee=int(17e9), lp_fee_ppm=145_000, protocol_fee_ppm=21_000),
    )

    # Timetravel after claim period
    ape.chain.mine(deltatime=claim_period)

    withdraw_tx = request_manager.withdraw(claim_id, sender=claimer)
    assert withdraw_tx.events.filter(request_manager.ClaimStakeWithdrawn)
    assert request_manager.tokens(token)[RM_T_FIELD_COLLECTED_PROTOCOL_FEES] == protocol_fee
    assert token.balanceOf(request_manager) == protocol_fee
    assert token.balanceOf(claimer) == transfer_amount + lp_fee


def test_protocol_fee_is_zero(request_manager, token):
    # For the time being, the protocol fee percentage should be zero.
    assert request_manager.tokens(token.address)[RM_T_FIELD_PROTOCOL_FEE_PPM] == 0
    assert request_manager.protocolFee(token.address, 23_000_000) == 0


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
        fee_data=tuple(_NONZERO_FEE_DATA.values()),
    )
    protocol_fee = request_manager.requests(request_id)[RM_R_FIELD_PROTOCOL_FEE]

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


def test_fee_data_updatable_by_owner(request_manager, token):
    (requester,) = alloc_accounts(1)

    new_fee_data = dict(min_lp_fee=int(179e18), lp_fee_ppm=13_000, protocol_fee_ppm=12_000)

    with ape.reverts("Ownable: caller is not the owner"):
        update_token(
            request_manager,
            token,
            new_fee_data,
            sender=requester,
        )

    update_token(
        request_manager,
        token,
        new_fee_data,
    )

    token_data = request_manager.tokens(token.address)
    assert token_data[1:-1] == tuple(new_fee_data.values())


def test_fee_reimbursed_on_expiration(request_manager, token):
    (requester,) = alloc_accounts(1)
    transfer_amount = 23_000_000
    validity_period = request_manager.MIN_VALIDITY_PERIOD()

    update_token(request_manager, token, _NONZERO_FEE_DATA)
    request_id = make_request(
        request_manager,
        token,
        requester,
        requester,
        transfer_amount,
        fee_data="standard",
        validity_period=validity_period,
    )

    total_fee = request_manager.totalFee(token.address, transfer_amount)
    assert total_fee > 0

    # Timetravel after validity period
    ape.chain.mine(deltatime=validity_period)

    request_manager.withdrawExpiredRequest(request_id, sender=requester)
    assert token.balanceOf(requester) == transfer_amount + total_fee


def test_insufficient_lp_fee(request_manager, token):
    (requester,) = alloc_accounts(1)
    amount = 23_000_000
    validity_period = request_manager.MIN_VALIDITY_PERIOD()

    assert request_manager.lpFee(token.address, amount) > 0
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
    fee_data_1 = int(6e18), 8_000, 7_000
    fee_data_2 = 1, 4_000, 31_000

    with ape.accounts.test_accounts.use_sender(requester):
        token.mint(requester, amount * 10)
        token.approve(request_manager.address, 2**256 - 1)

    with temp_fee_data(request_manager, token, *fee_data_1):
        request_id_1 = make_request(
            request_manager, token, requester, requester, amount, fee_data="standard"
        )
        lp_fee_1 = request_manager.lpFee(token.address, amount)
        protocol_fee_1 = request_manager.protocolFee(token.address, amount)
        assert lp_fee_1 == 6e18
        assert protocol_fee_1 == 63e15

    with temp_fee_data(request_manager, token, *fee_data_2):
        request_id_2 = make_request(
            request_manager, token, requester, requester, amount, fee_data="standard"
        )
        lp_fee_2 = request_manager.lpFee(token.address, amount)
        protocol_fee_2 = request_manager.protocolFee(token.address, amount)
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
        assert request_manager.tokens(token)[RM_T_FIELD_COLLECTED_PROTOCOL_FEES] == protocol_fee_1
        assert (
            token.balanceOf(request_manager) == amount + protocol_fee_1 + protocol_fee_2 + lp_fee_2
        )
        assert token.balanceOf(claimer) == amount + lp_fee_1

        withdraw_tx = request_manager.withdraw(claim_id_2)
        assert withdraw_tx.events.filter(request_manager.ClaimStakeWithdrawn)
    assert (
        request_manager.tokens(token)[RM_T_FIELD_COLLECTED_PROTOCOL_FEES]
        == protocol_fee_1 + protocol_fee_2
    )
    assert token.balanceOf(request_manager) == protocol_fee_1 + protocol_fee_2
    assert token.balanceOf(claimer) == amount * 2 + lp_fee_1 + lp_fee_2


def test_ppm_out_of_bound(request_manager, token):
    ppm = 999_999

    request_manager.updateToken(token.address, 0, 0, ppm, 0)
    request_manager.updateToken(token.address, 0, 0, 0, ppm)

    ppm = 1_000_000

    with ape.reverts("Maximum PPM of 999999 exceeded"):
        request_manager.updateToken(token.address, 0, 0, ppm, 0)

    with ape.reverts("Maximum PPM of 999999 exceeded"):
        request_manager.updateToken(token.address, 0, 0, 0, ppm)
