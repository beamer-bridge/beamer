import ape
import pytest
from hexbytes import HexBytes
from web3.constants import ADDRESS_ZERO

from beamer.tests.agent.utils import make_address
from beamer.tests.constants import FILL_ID
from beamer.tests.util import alloc_accounts, alloc_whitelisted_accounts, earnings, make_request
from beamer.typing import ClaimId, FillId, Termination


def test_request_invalid_target_chain(request_manager, token):
    (requester,) = alloc_accounts(1)
    with ape.reverts("Target rollup not supported"):
        make_request(
            request_manager,
            target_chain_id=999,
            token=token,
            requester=requester,
            target_address=requester,
            amount=1,
        )

    assert request_manager.currentNonce() == 0
    make_request(
        request_manager,
        target_chain_id=ape.chain.chain_id,
        token=token,
        requester=requester,
        target_address=requester,
        amount=1,
    )
    assert request_manager.currentNonce() == 1


def test_claim(token, request_manager, claim_stake):
    """Test that making a claim creates correct claim and emits event"""
    (requester,) = alloc_accounts(1)
    (claimer,) = alloc_whitelisted_accounts(1, [request_manager])
    request_id = make_request(
        request_manager, token=token, requester=requester, target_address=requester, amount=1
    )

    with ape.reverts("Ownable: caller is not the owner"):
        request_manager.addAllowedLp(claimer, sender=requester)

    whitelist_tx = request_manager.addAllowedLp(claimer)
    assert whitelist_tx.events.filter(request_manager.LpAdded)

    claim_tx = request_manager.claimRequest(request_id, FILL_ID, sender=claimer, value=claim_stake)
    claim_id = claim_tx.return_value
    expected_termination = request_manager.claimPeriod() + ape.chain.blocks[-1].timestamp

    assert claim_tx.events.filter(
        request_manager.ClaimMade,
        requestId=request_id,
        claimId=claim_id,
        claimer=claimer,
        claimerStake=claim_stake,
        lastChallenger=ADDRESS_ZERO,
        challengerStakeTotal=0,
        termination=expected_termination,
        fillId=FILL_ID,
    )

    blacklist_tx = request_manager.removeAllowedLp(claimer)

    assert blacklist_tx.events.filter(request_manager.LpRemoved)

    with ape.reverts("Not allowed"):
        request_manager.claimRequest(request_id, FILL_ID, sender=claimer, value=claim_stake)


def test_claim_with_different_stakes(token, request_manager, claim_stake):
    """Test that only claims with the correct stake can be submitted"""
    (requester,) = alloc_accounts(1)
    (claimer,) = alloc_whitelisted_accounts(1, [request_manager])
    request_id = make_request(request_manager, token, requester, requester, 1)

    with ape.accounts.test_accounts.use_sender(claimer):
        claim = request_manager.claimRequest(request_id, FILL_ID, value=claim_stake)
        assert claim.events.filter(request_manager.ClaimMade)

        with ape.reverts("Invalid stake amount"):
            request_manager.claimRequest(request_id, FILL_ID, value=claim_stake - 1)

        with ape.reverts("Invalid stake amount"):
            request_manager.claimRequest(request_id, FILL_ID, value=claim_stake + 1)

        with ape.reverts("Invalid stake amount"):
            request_manager.claimRequest(request_id, FILL_ID)


def test_claim_on_behalf_of_other(token, request_manager, claim_stake, claim_period):
    """
    Test that making a claim on behalf of others creates correct claim
    and claimer can withdraw afterwards
    """
    (
        requester,
        initiator,
    ) = alloc_accounts(2)
    (claimer,) = alloc_whitelisted_accounts(1, [request_manager])

    transfer_amount = 92
    web3 = ape.chain.provider.web3
    initiator_eth_balance = web3.eth.get_balance(initiator.address)
    claimer_eth_balance = web3.eth.get_balance(claimer.address)

    token.mint(requester, transfer_amount, sender=requester)
    assert token.balanceOf(requester) == transfer_amount
    assert token.balanceOf(initiator) == 0
    assert token.balanceOf(claimer) == 0

    request_id = make_request(
        request_manager,
        token=token,
        requester=requester,
        target_address=requester,
        amount=transfer_amount,
    )

    claim_tx = request_manager.claimRequest(
        claimer, request_id, FILL_ID, sender=initiator, value=claim_stake
    )
    claim_id = claim_tx.return_value
    expected_termination = request_manager.claimPeriod() + ape.chain.blocks[-1].timestamp
    assert claim_tx.events.filter(
        request_manager.ClaimMade,
        requestId=request_id,
        claimId=claim_id,
        claimer=claimer,
        claimerStake=claim_stake,
        lastChallenger=ADDRESS_ZERO,
        challengerStakeTotal=0,
        termination=expected_termination,
        fillId=FILL_ID,
    )

    assert web3.eth.get_balance(request_manager.address) == claim_stake
    assert web3.eth.get_balance(initiator.address) == initiator_eth_balance - claim_stake
    assert web3.eth.get_balance(claimer.address) == claimer_eth_balance

    ape.chain.mine(deltatime=claim_period)
    withdraw_tx = request_manager.withdraw(claim_id, sender=claimer)

    assert withdraw_tx.events.filter(request_manager.DepositWithdrawn)
    assert withdraw_tx.events.filter(request_manager.ClaimStakeWithdrawn)
    assert request_manager.isWithdrawn(request_id)

    assert token.balanceOf(requester) == 0
    assert token.balanceOf(initiator) == 0
    assert token.balanceOf(claimer) == transfer_amount

    assert web3.eth.get_balance(request_manager.address) == 0
    assert web3.eth.get_balance(initiator.address) == initiator_eth_balance - claim_stake
    assert web3.eth.get_balance(claimer.address) == claimer_eth_balance + claim_stake


def test_claimer_not_allowed(token, request_manager, claim_stake):
    """Test that making a claim cannot be done for addresses which are not whitelisted"""
    (requester, initiator, claimer) = alloc_accounts(3)
    request_id = make_request(
        request_manager, token=token, requester=requester, target_address=requester, amount=1
    )
    with ape.reverts("Not allowed"):
        request_manager.claimRequest(
            claimer, request_id, FILL_ID, sender=initiator, value=claim_stake
        )


def test_claim_challenge(request_manager, token, claim_stake):
    """Test challenging a claim"""
    requester, challenger = alloc_accounts(2)
    (claimer,) = alloc_whitelisted_accounts(1, [request_manager])
    request_id = make_request(request_manager, token, requester, requester, 1)

    claim = request_manager.claimRequest(request_id, FILL_ID, sender=claimer, value=claim_stake)

    with ape.accounts.test_accounts.use_sender(challenger):
        with ape.reverts("Not enough stake provided"):
            request_manager.challengeClaim(claim.return_value, value=claim_stake)

        with ape.reverts("Not enough stake provided"):
            request_manager.challengeClaim(claim.return_value)

    with ape.reverts("Cannot challenge own claim"):
        request_manager.challengeClaim(claim.return_value, sender=claimer, value=claim_stake + 1)

    with ape.accounts.test_accounts.use_sender(challenger):
        # Do a proper challenge
        challenge = request_manager.challengeClaim(claim.return_value, value=claim_stake + 1)
        assert challenge.events.filter(request_manager.ClaimMade)

        with ape.reverts("Not eligible to outbid"):
            request_manager.challengeClaim(claim.return_value, value=claim_stake + 1)


def test_claim_counter_challenge(request_manager, token, claim_stake):
    """Test counter-challenging a challenge"""
    challenger, requester = alloc_accounts(2)
    (claimer,) = alloc_whitelisted_accounts(1, [request_manager])
    request_id = make_request(request_manager, token, requester, requester, 1)

    claim = request_manager.claimRequest(request_id, FILL_ID, sender=claimer, value=claim_stake)
    claim_id = claim.return_value

    with ape.reverts("Not enough stake provided"):
        request_manager.challengeClaim(claim_id, sender=requester, value=claim_stake)

    # Do a proper challenge
    request_manager.challengeClaim(claim_id, sender=challenger, value=claim_stake + 1)

    # Only the claimer is eligible to outbid the challengers
    with ape.reverts("Not eligible to outbid"):
        request_manager.challengeClaim(claim_id, sender=requester)

    # The sender of the last challenge must not be able to challenge again
    with ape.reverts("Not eligible to outbid"):
        request_manager.challengeClaim(claim_id, sender=challenger)

    with ape.accounts.test_accounts.use_sender(claimer):
        # The other party, in this case the claimer, must be able to re-challenge
        with ape.reverts("Not enough stake provided"):
            request_manager.challengeClaim(claim_id, value=claim_stake)
        outbid = request_manager.challengeClaim(claim_id, value=claim_stake + 1)
        assert outbid.events.filter(request_manager.ClaimMade)

        # Check that claimer is leading and cannot challenge own claim
        with ape.reverts("Cannot challenge own claim"):
            request_manager.challengeClaim(claim_id, value=1)

    with ape.accounts.test_accounts.use_sender(challenger):
        # The challenger must be able to re-challenge, but must increase the stake
        with ape.reverts("Not enough stake provided"):
            request_manager.challengeClaim(claim_id, value=claim_stake)
        outbid = request_manager.challengeClaim(claim_id, value=claim_stake + 1)
        assert outbid.events.filter(request_manager.ClaimMade)


def test_claim_two_challengers(request_manager, token, claim_stake):
    """Test that two different challengers can challenge"""
    first_challenger, second_challenger, requester = alloc_accounts(3)
    (claimer,) = alloc_whitelisted_accounts(1, [request_manager])
    request_id = make_request(request_manager, token, requester, requester, 1)

    claim = request_manager.claimRequest(request_id, FILL_ID, sender=claimer, value=claim_stake)
    claim_id = claim.return_value

    # First challenger challenges
    outbid = request_manager.challengeClaim(
        claim_id, sender=first_challenger, value=claim_stake + 1
    )
    assert outbid.events.filter(request_manager.ClaimMade)

    with ape.accounts.test_accounts.use_sender(claimer):
        # Claimer outbids again
        outbid = request_manager.challengeClaim(claim_id, value=claim_stake + 1)
        assert outbid.events.filter(request_manager.ClaimMade)

        # Check that claimer cannot be second challenger
        with ape.reverts("Cannot challenge own claim"):
            request_manager.challengeClaim(claim_id, value=claim_stake + 1)

    # Second challenger challenges
    outbid = request_manager.challengeClaim(
        claim_id, sender=second_challenger, value=claim_stake + 1
    )
    assert outbid.events.filter(request_manager.ClaimMade)


def test_claim_period_extension(
    request_manager,
    token,
    claim_stake,
    claim_period,
    finality_period,
    challenge_period_extension,
):
    """Test the extension of the claim/challenge period"""
    challenger, requester = alloc_accounts(2)
    (claimer,) = alloc_whitelisted_accounts(1, [request_manager])
    request_id = make_request(request_manager, token, requester, requester, 1)

    claim = request_manager.claimRequest(request_id, FILL_ID, sender=claimer, value=claim_stake)
    claim_id = claim.return_value

    def _get_claim_termination(_claim_id: ClaimId) -> Termination:
        return request_manager.claims(_claim_id).termination

    assert ape.chain.blocks[-1].timestamp + claim_period == _get_claim_termination(claim_id)

    request_manager.challengeClaim(claim_id, sender=challenger, value=claim_stake + 1)
    challenge_period = finality_period + challenge_period_extension

    claim_termination = _get_claim_termination(claim_id)
    assert ape.chain.blocks[-1].timestamp + challenge_period == claim_termination

    # Another challenge with big margin to the end of the termination
    # shouldn't increase the termination
    request_manager.challengeClaim(claim_id, sender=claimer, value=claim_stake + 1)

    assert claim_termination == _get_claim_termination(claim_id)

    # Another challenge by challenger also shouldn't increase the end of termination
    request_manager.challengeClaim(claim_id, sender=challenger, value=claim_stake + 1)
    assert claim_termination == _get_claim_termination(claim_id)

    # Timetravel close to end of challenge period
    ape.chain.mine(timestamp=_get_claim_termination(claim_id) - 10)

    old_claim_termination = claim_termination
    # Claimer challenges close to the end of challenge
    # Should increase the challenge termination
    request_manager.challengeClaim(claim_id, sender=claimer, value=claim_stake + 1)

    new_claim_termination = _get_claim_termination(claim_id)
    assert ape.chain.blocks[-1].timestamp + challenge_period_extension == new_claim_termination
    assert new_claim_termination > old_claim_termination

    # Timetravel close to end of challenge period
    ape.chain.mine(timestamp=_get_claim_termination(claim_id) - 10)

    old_claim_termination = new_claim_termination
    request_manager.challengeClaim(claim_id, sender=challenger, value=claim_stake + 1)
    new_claim_termination = _get_claim_termination(claim_id)
    assert ape.chain.blocks[-1].timestamp + challenge_period_extension == new_claim_termination
    assert new_claim_termination > old_claim_termination

    # Timetravel over the end of challenge period
    ape.chain.mine(timestamp=_get_claim_termination(claim_id) + 1)

    with ape.reverts("Claim expired"):
        request_manager.challengeClaim(claim_id, sender=claimer, value=claim_stake + 1)


def test_withdraw_nonexistent_claim(request_manager):
    """Test withdrawing a non-existent claim"""
    with ape.reverts("claimId not valid"):
        request_manager.withdraw(1234, sender=alloc_accounts(1)[0])


def test_claim_nonexistent_request(request_manager):
    """Test claiming a non-existent request"""
    (claimer,) = alloc_whitelisted_accounts(1, [request_manager])
    with ape.reverts("requestId not valid"):
        request_manager.claimRequest(b"1234", FILL_ID, sender=claimer)


def test_claim_request_extension(request_manager, token, claim_stake):
    """
    Test that claiming is allowed around expiry
    and will revert after validUntil + claimRequestExtension
    """
    (requester,) = alloc_accounts(1)
    (claimer,) = alloc_whitelisted_accounts(1, [request_manager])
    token.mint(requester, 1, sender=requester)
    request_id = make_request(request_manager, token, requester, requester, 1)

    valid_until = request_manager.requests(request_id).validUntil
    claim_request_extension = request_manager.claimRequestExtension()
    # test that request expiration does not prevent claiming
    timestamps = [valid_until - 1, valid_until, valid_until + claim_request_extension - 1]

    with ape.accounts.test_accounts.use_sender(claimer):
        for timestamp in timestamps:
            ape.chain.pending_timestamp += timestamp - ape.chain.pending_timestamp
            request_manager.claimRequest(request_id, FILL_ID, value=claim_stake)

        # validUntil + claimRequestExtension
        ape.chain.pending_timestamp += 1
        with ape.reverts("Request cannot be claimed anymore"):
            request_manager.claimRequest(request_id, FILL_ID, value=claim_stake)


def test_withdraw_without_challenge(request_manager, token, claim_stake, claim_period):
    """Test withdraw when a claim was not challenged"""
    (requester,) = alloc_accounts(1)
    (claimer,) = alloc_whitelisted_accounts(1, [request_manager])

    transfer_amount = 23

    web3 = ape.chain.provider.web3
    claimer_eth_balance = web3.eth.get_balance(claimer.address)

    token.mint(requester, transfer_amount, sender=requester)
    assert token.balanceOf(requester) == transfer_amount
    assert token.balanceOf(claimer) == 0

    assert web3.eth.get_balance(request_manager.address) == 0

    request_id = make_request(request_manager, token, requester, requester, transfer_amount)

    with ape.accounts.test_accounts.use_sender(claimer):
        claim_tx = request_manager.claimRequest(request_id, FILL_ID, value=claim_stake)
        claim_id = claim_tx.return_value

        assert web3.eth.get_balance(request_manager.address) == claim_stake
        assert web3.eth.get_balance(claimer.address) == claimer_eth_balance - claim_stake

        # Withdraw must fail when claim period is not over
        with ape.reverts("Claim period not finished"):
            request_manager.withdraw(claim_id)

        # Timetravel after claim period
        ape.chain.mine(deltatime=claim_period)

        withdraw_tx = request_manager.withdraw(claim_id)
        assert withdraw_tx.events.filter(request_manager.DepositWithdrawn)
        assert withdraw_tx.events.filter(request_manager.ClaimStakeWithdrawn)
        assert request_manager.isWithdrawn(request_id)

        assert token.balanceOf(requester) == 0
        assert token.balanceOf(claimer) == transfer_amount

        assert web3.eth.get_balance(request_manager.address) == 0
        assert web3.eth.get_balance(claimer.address) == claimer_eth_balance

        # Another withdraw must fail
        with ape.reverts("Claim already withdrawn"):
            request_manager.withdraw(claim_id)


def test_withdraw_with_challenge(
    request_manager, token, claim_stake, finality_period, challenge_period_extension
):
    """Test withdraw when a claim was challenged, and the challenger won.
    In that case, the request funds must not be paid out to the challenger."""

    requester, challenger = alloc_accounts(2)
    (claimer,) = alloc_whitelisted_accounts(1, [request_manager])
    transfer_amount = 23

    web3 = ape.chain.provider.web3
    claimer_eth_balance = web3.eth.get_balance(claimer.address)
    challenger_eth_balance = web3.eth.get_balance(challenger.address)

    token.mint(requester, transfer_amount, sender=requester)
    assert token.balanceOf(requester) == transfer_amount
    assert token.balanceOf(claimer) == 0
    assert token.balanceOf(challenger) == 0

    assert web3.eth.get_balance(request_manager.address) == 0

    request_id = make_request(request_manager, token, requester, requester, transfer_amount)
    claim_tx = request_manager.claimRequest(request_id, FILL_ID, sender=claimer, value=claim_stake)
    claim_id = claim_tx.return_value

    assert token.balanceOf(request_manager.address) == transfer_amount

    assert web3.eth.get_balance(claimer.address) == claimer_eth_balance - claim_stake
    assert web3.eth.get_balance(challenger.address) == challenger_eth_balance

    request_manager.challengeClaim(claim_id, sender=challenger, value=claim_stake + 1)

    assert web3.eth.get_balance(claimer.address) == claimer_eth_balance - claim_stake
    assert web3.eth.get_balance(challenger.address) == challenger_eth_balance - claim_stake - 1

    # Withdraw must fail when claim period is not over
    with ape.reverts("Claim period not finished"):
        request_manager.withdraw(claim_id, sender=claimer)

    # Timetravel after challenge period
    ape.chain.mine(deltatime=finality_period + challenge_period_extension)

    assert web3.eth.get_balance(request_manager.address) == 2 * claim_stake + 1

    # The challenger sent the last bid
    # Even if the requester calls withdraw, the challenge stakes go to the challenger
    # However, the request funds stay in the contract
    withdraw_tx = request_manager.withdraw(claim_id, sender=challenger)
    assert withdraw_tx.events.filter(request_manager.ClaimStakeWithdrawn)
    assert not withdraw_tx.events.filter(request_manager.DepositWithdrawn)
    assert not request_manager.isWithdrawn(request_id)

    assert token.balanceOf(requester) == 0
    assert token.balanceOf(claimer) == 0
    assert token.balanceOf(challenger) == 0
    assert token.balanceOf(request_manager.address) == transfer_amount

    assert web3.eth.get_balance(request_manager.address) == 0
    assert web3.eth.get_balance(claimer.address) == claimer_eth_balance - claim_stake
    assert web3.eth.get_balance(challenger.address) == challenger_eth_balance + claim_stake

    # Another withdraw must fail
    with ape.reverts("Claim already withdrawn"):
        request_manager.withdraw(claim_id, sender=claimer)


def test_withdraw_with_two_claims(deployer, request_manager, token, claim_stake, claim_period):
    """Test withdraw when a request was claimed twice"""
    (requester,) = alloc_accounts(1)
    claimer1, claimer2 = alloc_whitelisted_accounts(2, [request_manager])
    transfer_amount = 23

    web3 = ape.chain.provider.web3
    claimer1_eth_balance = web3.eth.get_balance(claimer1.address)
    claimer2_eth_balance = web3.eth.get_balance(claimer2.address)

    token.mint(requester, transfer_amount, sender=requester)
    assert token.balanceOf(requester) == transfer_amount
    assert token.balanceOf(claimer1) == 0
    assert token.balanceOf(claimer2) == 0

    assert web3.eth.get_balance(request_manager.address) == 0

    request_id = make_request(request_manager, token, requester, requester, transfer_amount)

    claim1_tx = request_manager.claimRequest(
        request_id, FILL_ID, sender=claimer1, value=claim_stake
    )
    claim1_id = claim1_tx.return_value

    claim2_tx = request_manager.claimRequest(
        request_id, FILL_ID, sender=claimer2, value=claim_stake
    )
    claim2_id = claim2_tx.return_value

    assert web3.eth.get_balance(claimer1.address) == claimer1_eth_balance - claim_stake
    assert web3.eth.get_balance(claimer2.address) == claimer2_eth_balance - claim_stake

    with ape.accounts.test_accounts.use_sender(claimer1):
        # Withdraw must fail when claim period is not over
        with ape.reverts("Claim period not finished"):
            request_manager.withdraw(claim1_id)

        # Timetravel after claim period
        ape.chain.mine(deltatime=claim_period)

        assert web3.eth.get_balance(request_manager.address) == 2 * claim_stake

        # The first claim gets withdrawn first
        withdraw1_tx = request_manager.withdraw(claim1_id)
        assert withdraw1_tx.events.filter(request_manager.DepositWithdrawn)
        assert withdraw1_tx.events.filter(request_manager.ClaimStakeWithdrawn)

        assert token.balanceOf(requester) == 0
        assert token.balanceOf(claimer1) == transfer_amount
        assert token.balanceOf(claimer2) == 0

        assert web3.eth.get_balance(request_manager.address) == claim_stake
        assert web3.eth.get_balance(claimer1.address) == claimer1_eth_balance
        assert web3.eth.get_balance(claimer2.address) == claimer2_eth_balance - claim_stake

        # Another withdraw must fail
        with ape.reverts("Claim already withdrawn"):
            request_manager.withdraw(claim1_id)

    # The other claim must be withdrawable, but the claim stakes go to the
    # contract owner as it is a false claim but no challenger exists.
    with earnings(web3, deployer) as owner_earnings:
        withdraw2_tx = request_manager.withdraw(claimer2, claim2_id, sender=requester)

    assert not withdraw2_tx.events.filter(request_manager.DepositWithdrawn)
    assert withdraw2_tx.events.filter(request_manager.ClaimStakeWithdrawn)

    assert token.balanceOf(requester) == 0
    assert token.balanceOf(claimer1) == transfer_amount
    assert token.balanceOf(claimer2) == 0

    # Since there was no challenger, but claim2 was a false claim,
    # stakes go to the contract owner.
    assert owner_earnings() == claim_stake
    assert web3.eth.get_balance(claimer1.address) == claimer1_eth_balance
    assert web3.eth.get_balance(claimer2.address) == claimer2_eth_balance - claim_stake


@pytest.mark.parametrize("second_fill_id", [FILL_ID, FillId(b"wrong_fill_id")])
def test_withdraw_second_claim_same_claimer_different_fill_ids(
    request_manager, token, claim_stake, claim_period, second_fill_id
):
    """
    Test withdraw with two claims by the same address. First one is successful.
    If the second fill id is also equal to the first, this is an identical claim.
    The claimer should also win.
    If the fill id is different the challenger must win,
    even though the claimer was successful with a different claim and fill id.
    """
    requester, challenger = alloc_accounts(2)
    (claimer,) = alloc_whitelisted_accounts(1, [request_manager])
    transfer_amount = 23

    token.mint(requester, transfer_amount, sender=requester)
    assert token.balanceOf(requester) == transfer_amount
    assert token.balanceOf(claimer) == 0

    request_id = make_request(request_manager, token, requester, requester, transfer_amount)

    with ape.accounts.test_accounts.use_sender(claimer):
        claim1_tx = request_manager.claimRequest(request_id, FILL_ID, value=claim_stake)
        claim1_id = claim1_tx.return_value

        claim2_tx = request_manager.claimRequest(request_id, second_fill_id, value=claim_stake)
        claim2_id = claim2_tx.return_value

    web3 = ape.chain.provider.web3
    challenger_eth_balance = web3.eth.get_balance(challenger.address)
    assert web3.eth.get_balance(challenger.address) == challenger_eth_balance
    request_manager.challengeClaim(claim2_id, sender=challenger, value=claim_stake + 1)
    assert web3.eth.get_balance(challenger.address) == challenger_eth_balance - claim_stake - 1

    with ape.accounts.test_accounts.use_sender(claimer):
        # Withdraw must fail when claim period is not over
        with ape.reverts("Claim period not finished"):
            request_manager.withdraw(claim1_id)
        # Withdraw must fail when claim period is not over
        with ape.reverts("Claim period not finished"):
            request_manager.withdraw(claim2_id)

        # Timetravel after claim period
        ape.chain.mine(deltatime=claim_period)

        # Withdraw must fail because it was challenged
        with ape.reverts("Claim period not finished"):
            request_manager.withdraw(claim2_id)

        current_claimer_eth_balance = web3.eth.get_balance(claimer.address)

        withdraw_tx = request_manager.withdraw(claim1_id)
        assert withdraw_tx.events.filter(request_manager.DepositWithdrawn)
        assert withdraw_tx.events.filter(request_manager.ClaimStakeWithdrawn)

    assert web3.eth.get_balance(claimer.address) == current_claimer_eth_balance + claim_stake
    assert token.balanceOf(claimer) == transfer_amount

    claim_winner = claimer if second_fill_id == FILL_ID else challenger
    claim_loser = challenger if claimer == claim_winner else claimer

    claim_winner_balance = web3.eth.get_balance(claim_winner.address)
    claim_loser_balance = web3.eth.get_balance(claim_loser.address)

    # Even though the challenge period of claim2 isn't over, the claim can be resolved now.
    withdraw_tx = request_manager.withdraw(claim2_id, sender=claim_winner)

    assert not withdraw_tx.events.filter(request_manager.DepositWithdrawn)
    assert withdraw_tx.events.filter(request_manager.ClaimStakeWithdrawn)

    assert web3.eth.get_balance(claim_winner.address) == claim_winner_balance + 2 * claim_stake + 1
    assert web3.eth.get_balance(claim_loser.address) == claim_loser_balance


def test_withdraw_with_two_claims_and_challenge(request_manager, token, claim_stake, claim_period):
    """Test withdraw when a request was claimed twice and challenged"""
    requester, challenger = alloc_accounts(2)
    claimer1, claimer2 = alloc_whitelisted_accounts(2, [request_manager])
    transfer_amount = 23

    web3 = ape.chain.provider.web3
    claimer1_eth_balance = web3.eth.get_balance(claimer1.address)
    claimer2_eth_balance = web3.eth.get_balance(claimer2.address)
    challenger_eth_balance = web3.eth.get_balance(challenger.address)

    token.mint(requester, transfer_amount, sender=requester)
    assert token.balanceOf(requester) == transfer_amount
    assert token.balanceOf(claimer1) == 0
    assert token.balanceOf(claimer2) == 0

    assert web3.eth.get_balance(request_manager.address) == 0

    request_id = make_request(request_manager, token, requester, requester, transfer_amount)

    claim1_tx = request_manager.claimRequest(
        request_id, FILL_ID, sender=claimer1, value=claim_stake
    )
    claim1_id = claim1_tx.return_value

    claim2_tx = request_manager.claimRequest(
        request_id, FILL_ID, sender=claimer2, value=claim_stake
    )
    claim2_id = claim2_tx.return_value

    assert web3.eth.get_balance(claimer1.address) == claimer1_eth_balance - claim_stake
    assert web3.eth.get_balance(claimer2.address) == claimer2_eth_balance - claim_stake
    assert web3.eth.get_balance(challenger.address) == challenger_eth_balance

    request_manager.challengeClaim(claim2_id, sender=challenger, value=claim_stake + 1)

    assert web3.eth.get_balance(claimer1.address) == claimer1_eth_balance - claim_stake
    assert web3.eth.get_balance(claimer2.address) == claimer2_eth_balance - claim_stake
    assert web3.eth.get_balance(challenger.address) == challenger_eth_balance - claim_stake - 1

    with ape.accounts.test_accounts.use_sender(claimer1):
        # Withdraw must fail when claim period is not over
        with ape.reverts("Claim period not finished"):
            request_manager.withdraw(claim1_id)

        # Timetravel after claim period
        ape.chain.mine(deltatime=claim_period)

        assert web3.eth.get_balance(request_manager.address) == 3 * claim_stake + 1

        # The first claim gets withdrawn first
        withdraw1_tx = request_manager.withdraw(claim1_id)
        assert withdraw1_tx.events.filter(request_manager.DepositWithdrawn)
        assert withdraw1_tx.events.filter(request_manager.ClaimStakeWithdrawn)
        assert request_manager.isWithdrawn(request_id)

        assert token.balanceOf(requester) == 0
        assert token.balanceOf(claimer1) == transfer_amount
        assert token.balanceOf(claimer2) == 0

        assert web3.eth.get_balance(request_manager.address) == 2 * claim_stake + 1
        assert web3.eth.get_balance(claimer1.address) == claimer1_eth_balance
        assert web3.eth.get_balance(claimer2.address) == claimer2_eth_balance - claim_stake
        assert web3.eth.get_balance(challenger.address) == challenger_eth_balance - claim_stake - 1

        # Another withdraw must fail
        with ape.reverts("Claim already withdrawn"):
            request_manager.withdraw(claim1_id)

    # The other claim must be withdrawable, but must not transfer tokens again
    request_manager.withdraw(claim2_id, sender=challenger)

    assert token.balanceOf(requester) == 0
    assert token.balanceOf(claimer1) == transfer_amount
    assert token.balanceOf(claimer2) == 0

    assert web3.eth.get_balance(request_manager.address) == 0
    assert web3.eth.get_balance(claimer1.address) == claimer1_eth_balance
    assert web3.eth.get_balance(claimer2.address) == claimer2_eth_balance - claim_stake
    assert web3.eth.get_balance(challenger.address) == challenger_eth_balance + claim_stake


def test_withdraw_with_two_claims_first_unsuccessful_then_successful(
    request_manager, token, claim_stake, claim_period, finality_period
):
    """Test withdraw when a request was claimed twice. The first claim fails, while the second
    is successful and should pay out the request funds."""
    requester, challenger = alloc_accounts(2)
    claimer1, claimer2 = alloc_whitelisted_accounts(2, [request_manager])
    transfer_amount = 23

    web3 = ape.chain.provider.web3
    claimer1_eth_balance = web3.eth.get_balance(claimer1.address)
    claimer2_eth_balance = web3.eth.get_balance(claimer2.address)
    challenger_eth_balance = web3.eth.get_balance(challenger.address)

    token.mint(requester, transfer_amount, sender=requester)
    assert token.balanceOf(requester) == transfer_amount
    assert token.balanceOf(claimer1) == 0
    assert token.balanceOf(claimer2) == 0
    assert token.balanceOf(request_manager.address) == 0

    assert web3.eth.get_balance(request_manager.address) == 0

    request_id = make_request(request_manager, token, requester, requester, transfer_amount)

    claim1_tx = request_manager.claimRequest(
        request_id, FILL_ID, sender=claimer1, value=claim_stake
    )
    claim1_id = claim1_tx.return_value

    claim2_tx = request_manager.claimRequest(
        request_id, FILL_ID, sender=claimer2, value=claim_stake
    )
    claim2_id = claim2_tx.return_value

    assert web3.eth.get_balance(claimer1.address) == claimer1_eth_balance - claim_stake
    assert web3.eth.get_balance(claimer2.address) == claimer2_eth_balance - claim_stake
    assert web3.eth.get_balance(challenger.address) == challenger_eth_balance

    request_manager.challengeClaim(claim1_id, sender=challenger, value=claim_stake + 1)

    assert web3.eth.get_balance(claimer1.address) == claimer1_eth_balance - claim_stake
    assert web3.eth.get_balance(claimer2.address) == claimer2_eth_balance - claim_stake
    assert web3.eth.get_balance(challenger.address) == challenger_eth_balance - claim_stake - 1

    # Withdraw must fail when claim period is not over
    with ape.reverts("Claim period not finished"):
        request_manager.withdraw(claim1_id, sender=claimer1)

    # Timetravel after claim period
    ape.chain.mine(deltatime=claim_period + finality_period)

    assert token.balanceOf(request_manager.address) == transfer_amount
    assert web3.eth.get_balance(request_manager.address) == 3 * claim_stake + 1

    # The first claim gets withdrawn first
    # As the challenger wins, no requests funds must be paid out
    withdraw1_tx = request_manager.withdraw(claim1_id, sender=challenger)
    assert not withdraw1_tx.events.filter(request_manager.DepositWithdrawn)

    assert token.balanceOf(requester) == 0
    assert token.balanceOf(claimer1) == 0
    assert token.balanceOf(claimer2) == 0
    assert token.balanceOf(request_manager.address) == transfer_amount

    assert web3.eth.get_balance(request_manager.address) == claim_stake
    assert web3.eth.get_balance(claimer1.address) == claimer1_eth_balance - claim_stake
    assert web3.eth.get_balance(claimer2.address) == claimer2_eth_balance - claim_stake
    assert web3.eth.get_balance(challenger.address) == challenger_eth_balance + claim_stake

    # Another withdraw must fail
    with ape.reverts("Claim already withdrawn"):
        request_manager.withdraw(claim1_id, sender=claimer1)

    # The other claim must be withdrawable and should pay out the funds
    withdraw2_tx = request_manager.withdraw(claim2_id, sender=claimer2)
    assert withdraw2_tx.events.filter(request_manager.ClaimStakeWithdrawn)
    assert withdraw2_tx.events.filter(request_manager.DepositWithdrawn)

    assert token.balanceOf(requester) == 0
    assert token.balanceOf(claimer1) == 0
    assert token.balanceOf(claimer2) == transfer_amount
    assert token.balanceOf(request_manager.address) == 0

    assert web3.eth.get_balance(request_manager.address) == 0
    assert web3.eth.get_balance(claimer1.address) == claimer1_eth_balance - claim_stake
    assert web3.eth.get_balance(claimer2.address) == claimer2_eth_balance
    assert web3.eth.get_balance(challenger.address) == challenger_eth_balance + claim_stake


def test_claim_after_withdraw(request_manager, token, claim_stake, claim_period):
    """Test that the same account can not claim a already withdrawn fill again"""
    (requester,) = alloc_accounts(1)
    (claimer,) = alloc_whitelisted_accounts(1, [request_manager])
    request_id = make_request(request_manager, token, requester, requester, 23)

    with ape.accounts.test_accounts.use_sender(claimer):
        claim_tx = request_manager.claimRequest(request_id, FILL_ID, value=claim_stake)
        claim_id = claim_tx.return_value

        # Timetravel after claim period
        ape.chain.mine(deltatime=claim_period)
        withdraw_tx = request_manager.withdraw(claim_id)
        assert withdraw_tx.events.filter(request_manager.DepositWithdrawn)
        assert withdraw_tx.events.filter(request_manager.ClaimStakeWithdrawn)

        # Claiming the same request again must fail
        with ape.reverts("Deposit already withdrawn"):
            request_manager.claimRequest(request_id, FILL_ID, value=claim_stake)


def test_second_claim_after_withdraw(deployer, request_manager, token, claim_stake, claim_period):
    """Test that one can withdraw a claim immediately after the request
    deposit has been withdrawn via another claim."""
    (requester,) = alloc_accounts(1)
    claimer1, claimer2 = alloc_whitelisted_accounts(2, [request_manager])
    request_id = make_request(request_manager, token, requester, requester, 23)

    web3 = ape.chain.provider.web3
    claimer1_eth_balance = web3.eth.get_balance(claimer1.address)
    claimer2_eth_balance = web3.eth.get_balance(claimer2.address)

    claim1_tx = request_manager.claimRequest(
        request_id, FILL_ID, sender=claimer1, value=claim_stake
    )
    claim1_id = claim1_tx.return_value

    # Timetravel after claim period / 2.
    ape.chain.mine(deltatime=claim_period // 2)
    claim2_tx = request_manager.claimRequest(
        request_id, FILL_ID, sender=claimer2, value=claim_stake
    )
    claim2_id = claim2_tx.return_value

    # Another claim from the future depositReceiver
    claim3_tx = request_manager.claimRequest(
        request_id, FILL_ID, sender=claimer1, value=claim_stake
    )
    claim3_id = claim3_tx.return_value

    # Timetravel after claim period / 2. At this point claim 1 can be
    # withdrawn (its claim period is over), but not claim 2 (its claim period
    # is not over yet).
    ape.chain.mine(deltatime=claim_period // 2)
    withdraw_tx = request_manager.withdraw(claim1_id, sender=claimer1)
    assert withdraw_tx.events.filter(request_manager.DepositWithdrawn)
    assert withdraw_tx.events.filter(request_manager.ClaimStakeWithdrawn)
    assert claimer1_eth_balance - claim_stake == web3.eth.get_balance(claimer1.address)

    # Withdrawing the second claim must now succeed immediately because the
    # deposit has been withdrawn and we do not need to wait for the claim
    # period. The stakes go to the contract owner.
    with earnings(web3, deployer) as owner_earnings:
        withdraw_tx = request_manager.withdraw(claim2_id, sender=claimer2)
    assert withdraw_tx.events.filter(request_manager.ClaimStakeWithdrawn)
    assert claimer2_eth_balance - claim_stake == web3.eth.get_balance(claimer2.address)
    assert owner_earnings() == claim_stake

    # Withdrawing the third claim must also succeed immediately.
    # Since the claimer is also the depositReceiver stakes go back to the claimer
    withdraw_tx = request_manager.withdraw(claim3_id, sender=claimer1)
    assert withdraw_tx.events.filter(request_manager.ClaimStakeWithdrawn)
    assert claimer1_eth_balance == web3.eth.get_balance(claimer1.address)


@pytest.mark.parametrize("invalidate", [True, False])
@pytest.mark.parametrize("l1_filler", [make_address(), None])
def test_withdraw_without_challenge_with_resolution(
    request_manager, token, claim_stake, contracts, invalidate, l1_filler
):
    """
    Test withdraw when a claim was not challenged, but L1 resolved
    It tests the combination of L1 resolution

    fill (invalid, valid)
            X
    l1 filler (honest claimer, dishonest claimer)

    In the invalid - dishonest claimer case, stakes go to the contract
    owner as there is no challenger
    In the invalid - honest claimer case, honest claimer reverts the
    invalidation in request.invalidFillIds
    """
    (requester,) = alloc_accounts(1)
    (claimer,) = alloc_whitelisted_accounts(1, [request_manager])
    transfer_amount = 23

    if l1_filler is None:
        l1_filler = claimer.address

    token.mint(requester, transfer_amount, sender=requester)

    web3 = ape.chain.provider.web3
    # Initial balances
    claimer_eth_balance = web3.eth.get_balance(claimer.address)
    owner_eth_balance = web3.eth.get_balance(request_manager.owner())
    request_manager_balance = web3.eth.get_balance(request_manager.address)

    requester_token_balance = token.balanceOf(requester)
    claimer_token_balance = token.balanceOf(claimer)

    # If no claims exist or are fully withdrawn
    # there should be no ETH on the request manager contract
    assert web3.eth.get_balance(request_manager.address) == 0

    request_id = make_request(request_manager, token, requester, requester, transfer_amount)

    # Claim
    fill_id = HexBytes(b"123")
    claim_tx = request_manager.claimRequest(request_id, fill_id, sender=claimer, value=claim_stake)
    claim_id = claim_tx.return_value

    assert web3.eth.get_balance(request_manager.address) == request_manager_balance + claim_stake
    assert web3.eth.get_balance(claimer.address) == claimer_eth_balance - claim_stake

    # Start L1 resolution
    contracts.l1_messenger.setLastSender(contracts.resolver.address)

    if invalidate:
        request_manager.invalidateFill(
            request_id, fill_id, ape.chain.chain_id, sender=contracts.l1_messenger
        )
    # Assert that invalidation works
    assert request_manager.isInvalidFill(request_id, fill_id) == invalidate

    # Register a L1 resolution
    request_manager.resolveRequest(
        request_id, fill_id, web3.eth.chain_id, l1_filler, sender=contracts.l1_messenger
    )

    # Assert that correct filler is resolved, it reverts the false invalidation
    if invalidate and l1_filler == claimer:
        assert not request_manager.isInvalidFill(request_id, fill_id)

    # The claim period is not over, but the resolution must allow withdrawal now
    withdraw_tx = request_manager.withdraw(claim_id, sender=claimer)

    if claimer == l1_filler:
        assert withdraw_tx.events.filter(request_manager.DepositWithdrawn)
        assert token.balanceOf(requester) == requester_token_balance - transfer_amount
        assert token.balanceOf(claimer) == claimer_token_balance + transfer_amount

    else:
        claimer_eth_balance -= claim_stake
        owner_eth_balance += claim_stake

    assert withdraw_tx.events.filter(request_manager.ClaimStakeWithdrawn)

    assert web3.eth.get_balance(request_manager.owner()) == owner_eth_balance
    assert web3.eth.get_balance(claimer.address) == claimer_eth_balance
    assert web3.eth.get_balance(request_manager.address) == request_manager_balance

    # Another withdraw must fail
    with ape.reverts("Claim already withdrawn"):
        request_manager.withdraw(claim_id, sender=claimer)


def test_withdraw_l1_resolved_muliple_claims(contracts, request_manager, token, claim_stake):
    (requester,) = alloc_accounts(1)
    claimer1, claimer2 = alloc_whitelisted_accounts(2, [request_manager])
    transfer_amount = 23
    token.mint(requester, transfer_amount, sender=requester)

    web3 = ape.chain.provider.web3
    # Initial balances
    first_claimer_eth_balance = web3.eth.get_balance(claimer1.address)
    second_claimer_eth_balance = web3.eth.get_balance(claimer2.address)
    owner_eth_balance = web3.eth.get_balance(request_manager.owner())

    request_id = make_request(request_manager, token, requester, requester, transfer_amount)

    # Creating 4 Claims
    fill_id = FILL_ID

    # Claim 1: valid claim
    claim_tx_1 = request_manager.claimRequest(
        request_id, fill_id, sender=claimer1, value=claim_stake
    )
    claim_id_1 = claim_tx_1.return_value

    # Claim 2: claimer is not the filler, invalid claim
    claim_tx_2 = request_manager.claimRequest(
        request_id, fill_id, sender=claimer2, value=claim_stake
    )
    claim_id_2 = claim_tx_2.return_value

    # Claim 3: another valid claim
    claim_tx_3 = request_manager.claimRequest(
        request_id, fill_id, sender=claimer1, value=claim_stake
    )
    claim_id_3 = claim_tx_3.return_value

    # Claim 4: claimer is the filler but fill id is wrong, invalid claim
    claim_tx_4 = request_manager.claimRequest(
        request_id, b"wrong fill id", sender=claimer1, value=claim_stake
    )
    claim_id_4 = claim_tx_4.return_value

    contracts.l1_messenger.setLastSender(contracts.resolver.address)

    with ape.accounts.test_accounts.use_sender(claimer1):
        # Before L1 resolution, all claims are still running and cannot be withdrawn
        with ape.reverts("Claim period not finished"):
            request_manager.withdraw(claim_id_1)
        with ape.reverts("Claim period not finished"):
            request_manager.withdraw(claim_id_3)
        with ape.reverts("Claim period not finished"):
            request_manager.withdraw(claim_id_4)

    with ape.reverts("Claim period not finished"):
        request_manager.withdraw(claim_id_2, sender=claimer2)

    # Start L1 resolution
    # Register a L1 resolution
    request_manager.resolveRequest(
        request_id, fill_id, web3.eth.chain_id, claimer1, sender=contracts.l1_messenger
    )

    # The claim period is not over, but the resolution must allow withdrawal now
    # Valid claim will result in payout
    withdraw_tx = request_manager.withdraw(claim_id_1, sender=claimer1)
    assert withdraw_tx.events.filter(request_manager.DepositWithdrawn)
    assert withdraw_tx.events.filter(request_manager.ClaimStakeWithdrawn)

    # Wrong claimer, since it is not challenged stakes go to the contract owner
    withdraw_tx = request_manager.withdraw(claim_id_2, sender=claimer2)
    assert not withdraw_tx.events.filter(request_manager.DepositWithdrawn)
    assert withdraw_tx.events.filter(request_manager.ClaimStakeWithdrawn)

    with ape.accounts.test_accounts.use_sender(claimer1):
        # Another valid claim, deposit is already withdrawn but stakes go back to claimer
        withdraw_tx = request_manager.withdraw(claim_id_3)
        assert not withdraw_tx.events.filter(request_manager.DepositWithdrawn)
        assert withdraw_tx.events.filter(request_manager.ClaimStakeWithdrawn)

        # Wrong fill id, since it is not challenged stakes go to the contract owner
        withdraw_tx = request_manager.withdraw(claim_id_4)
        assert not withdraw_tx.events.filter(request_manager.DepositWithdrawn)
        assert withdraw_tx.events.filter(request_manager.ClaimStakeWithdrawn)

    assert web3.eth.get_balance(claimer1.address) == first_claimer_eth_balance - claim_stake
    assert web3.eth.get_balance(claimer2.address) == second_claimer_eth_balance - claim_stake
    # Two of the claims were invalid, thus stakes went to the contract owner
    assert web3.eth.get_balance(request_manager.owner()) == owner_eth_balance + 2 * claim_stake


def test_challenge_after_l1_resolution(request_manager, token, claim_stake, contracts):
    (requester,) = alloc_accounts(1)
    (claimer,) = alloc_whitelisted_accounts(1, [request_manager])
    transfer_amount = 23

    token.mint(requester, transfer_amount, sender=requester)
    request_id = make_request(request_manager, token, requester, requester, transfer_amount)

    # Claim
    fill_id = HexBytes(b"123")
    claim_tx = request_manager.claimRequest(request_id, fill_id, sender=claimer, value=claim_stake)
    claim_id = claim_tx.return_value

    request_manager.invalidateFill(
        request_id, fill_id, ape.chain.chain_id, sender=contracts.l1_messenger
    )
    # Assert that invalidation works
    assert request_manager.isInvalidFill(request_id, fill_id)

    with ape.reverts("Fill already invalidated"):
        request_manager.challengeClaim(claim_id)

    request_manager.resolveRequest(
        request_id, fill_id, ape.chain.chain_id, claimer, sender=contracts.l1_messenger
    )

    with ape.reverts("Request already resolved"):
        request_manager.challengeClaim(claim_id)


def test_claim_invalidated_withdraw(request_manager, token, claim_stake, contracts):
    (requester, challenger) = alloc_accounts(2)
    (claimer,) = alloc_whitelisted_accounts(1, [request_manager])
    transfer_amount = 23
    web3 = ape.chain.provider.web3

    token.mint(requester, transfer_amount, sender=requester)
    request_id = make_request(request_manager, token, requester, requester, transfer_amount)
    claimer_balance = web3.eth.get_balance(claimer.address)
    challenger_balance = web3.eth.get_balance(challenger.address)

    # Claim
    fill_id = HexBytes(b"123")
    claim_tx = request_manager.claimRequest(request_id, fill_id, sender=claimer, value=claim_stake)
    claim_id = claim_tx.return_value

    request_manager.challengeClaim(claim_id, sender=challenger, value=claim_stake + 1)
    request_manager.challengeClaim(claim_id, sender=claimer, value=claim_stake + 1)

    # Malicious claimer has the highest stake now
    # The invalidation lets the challenger win though
    request_manager.invalidateFill(
        request_id, fill_id, ape.chain.chain_id, sender=contracts.l1_messenger
    )
    # Assert that invalidation works
    assert request_manager.isInvalidFill(request_id, fill_id)

    # Timetravel after claim expires
    # Timetravel is used to prove that if the algorithm was wrong, the
    # malicious claimer would get the money
    ape.chain.mine(deltatime=request_manager.claims(claim_id).termination)

    request_manager.withdraw(claim_id, sender=challenger)

    assert web3.eth.get_balance(claimer.address) == claimer_balance - 2 * claim_stake - 1
    assert web3.eth.get_balance(challenger.address) == challenger_balance + 2 * claim_stake + 1


def test_withdraw_on_behalf(
    request_manager, token, claim_stake, finality_period, challenge_period_extension
):
    first_challenger, second_challenger, requester, other = alloc_accounts(4)
    (claimer,) = alloc_whitelisted_accounts(1, [request_manager])

    request_id = make_request(request_manager, token, requester, requester, 1)
    claim = request_manager.claimRequest(request_id, FILL_ID, sender=claimer, value=claim_stake)
    claim_id = claim.return_value
    web3 = ape.chain.provider.web3
    first_challenger_eth_balance = web3.eth.get_balance(first_challenger.address)
    second_challenger_eth_balance = web3.eth.get_balance(second_challenger.address)

    # First challenger challenges
    request_manager.challengeClaim(claim_id, sender=first_challenger, value=claim_stake + 1)
    # Claimer outbids again
    request_manager.challengeClaim(claim_id, sender=claimer, value=claim_stake + 1)
    # Second challenger challenges
    request_manager.challengeClaim(claim_id, sender=second_challenger, value=claim_stake + 1)

    # Timetravel after claim period
    ape.chain.mine(deltatime=finality_period + challenge_period_extension)

    request_manager.withdraw(second_challenger, claim_id, sender=first_challenger)

    # second challenger should have won claim stake which is the excess amount the
    # claimer put in
    assert (
        web3.eth.get_balance(second_challenger.address)
        == second_challenger_eth_balance + claim_stake
    )

    assert (
        web3.eth.get_balance(first_challenger.address)
        == first_challenger_eth_balance - claim_stake - 1
    )

    # After the stakes are withdrawn for the second challenger
    # he is not an active participant anymore
    with ape.reverts("Not an active participant in this claim"):
        request_manager.withdraw(claim_id, sender=second_challenger)

    request_manager.withdraw(first_challenger, claim_id, sender=other)

    assert (
        web3.eth.get_balance(first_challenger.address)
        == first_challenger_eth_balance + claim_stake + 1
    )


def test_withdraw_on_behalf_of_challenger_claimer_wins(
    request_manager, token, claim_stake, finality_period, challenge_period_extension
):
    challenger, requester = alloc_accounts(2)
    (claimer,) = alloc_whitelisted_accounts(1, [request_manager])

    web3 = ape.chain.provider.web3
    claimer_eth_balance = web3.eth.get_balance(claimer.address)
    challenger_eth_balance = web3.eth.get_balance(challenger.address)

    request_id = make_request(request_manager, token, requester, requester, 1)
    claim = request_manager.claimRequest(request_id, FILL_ID, sender=claimer, value=claim_stake)
    claim_id = claim.return_value

    # First challenger challenges
    request_manager.challengeClaim(claim_id, sender=challenger, value=claim_stake + 1)
    # Claimer outbids again
    request_manager.challengeClaim(claim_id, sender=claimer, value=claim_stake + 1)

    # Timetravel after claim period
    ape.chain.mine(deltatime=finality_period + challenge_period_extension)

    withdraw_tx = request_manager.withdraw(challenger, claim_id, sender=challenger)
    assert withdraw_tx.events.filter(request_manager.ClaimStakeWithdrawn)
    assert withdraw_tx.events.filter(request_manager.DepositWithdrawn)

    assert web3.eth.get_balance(claimer.address) == claimer_eth_balance + claim_stake + 1
    assert web3.eth.get_balance(challenger.address) == challenger_eth_balance - claim_stake - 1


def test_withdraw_two_challengers(
    request_manager, token, claim_stake, finality_period, challenge_period_extension
):
    first_challenger, second_challenger, requester = alloc_accounts(3)
    (claimer,) = alloc_whitelisted_accounts(1, [request_manager])

    request_id = make_request(request_manager, token, requester, requester, 1)
    claim = request_manager.claimRequest(request_id, FILL_ID, sender=claimer, value=claim_stake)
    claim_id = claim.return_value
    web3 = ape.chain.provider.web3
    first_challenger_eth_balance = web3.eth.get_balance(first_challenger.address)
    second_challenger_eth_balance = web3.eth.get_balance(second_challenger.address)

    # First challenger challenges
    request_manager.challengeClaim(claim_id, sender=first_challenger, value=claim_stake + 1)
    # Claimer outbids again
    request_manager.challengeClaim(claim_id, sender=claimer, value=claim_stake + 10)
    # Second challenger challenges
    request_manager.challengeClaim(claim_id, sender=second_challenger, value=claim_stake + 11)

    first_challenger_reward = claim_stake + 1
    second_challenger_reward = claim_stake + 9

    # Withdraw must fail when claim period is not over
    with ape.reverts("Claim period not finished"):
        request_manager.withdraw(claim_id, sender=first_challenger)
    # Withdraw must fail when claim period is not over
    with ape.reverts("Claim period not finished"):
        request_manager.withdraw(claim_id, sender=second_challenger)
    # Withdraw must fail when claim period is not over
    with ape.reverts("Claim period not finished"):
        request_manager.withdraw(claim_id, sender=claimer)

    # Timetravel after claim period
    ape.chain.mine(deltatime=finality_period + challenge_period_extension)

    # Take snapshot
    snap_id = ape.chain.snapshot()

    def _withdraw_by_order(first_withdrawer, second_withdrawer):
        with ape.accounts.test_accounts.use_sender(first_withdrawer):
            request_manager.withdraw(claim_id)

            # Challenger cannot withdraw twice
            with ape.reverts("Not an active participant in this claim"):
                request_manager.withdraw(claim_id)
        with ape.reverts("Challenger has nothing to withdraw"):
            request_manager.withdraw(claim_id, sender=claimer)

        request_manager.withdraw(claim_id, sender=second_withdrawer)

        assert (
            web3.eth.get_balance(first_challenger.address)
            == first_challenger_eth_balance + first_challenger_reward
        )
        assert (
            web3.eth.get_balance(second_challenger.address)
            == second_challenger_eth_balance + second_challenger_reward
        )

    _withdraw_by_order(first_challenger, second_challenger)
    # revert to snapshot
    ape.chain.restore(snap_id)
    _withdraw_by_order(second_challenger, first_challenger)

    # All stakes are withdrawn already
    with ape.reverts("Claim already withdrawn"):
        request_manager.withdraw(claim_id, sender=claimer)


def test_withdraw_expired(token, request_manager):
    """Test that a request can be withdrawn once it is expired"""
    validity_period = request_manager.MIN_VALIDITY_PERIOD()
    (requester,) = alloc_accounts(1)

    amount = 17
    token.mint(requester, amount)

    request_id = make_request(
        request_manager, token, requester, requester, amount, validity_period=validity_period
    )

    assert token.balanceOf(requester) == 0

    ape.chain.mine(deltatime=validity_period)
    tx = request_manager.withdrawExpiredRequest(request_id, sender=requester)
    assert tx.events.filter(request_manager.DepositWithdrawn)
    assert request_manager.isWithdrawn(request_id)
    assert token.balanceOf(requester) == amount


def test_withdraw_before_expiration(token, request_manager):
    """Test that a request cannot be withdrawn before it is expired"""
    validity_period = request_manager.MIN_VALIDITY_PERIOD()
    (requester,) = alloc_accounts(1)

    request_id = make_request(
        request_manager, token, requester, requester, 1, validity_period=validity_period
    )

    ape.chain.mine(deltatime=validity_period // 2)
    with ape.reverts("Request not expired yet"):
        request_manager.withdrawExpiredRequest(request_id, sender=requester)


def test_withdrawal_state_of_new_request(token, request_manager):
    """Test that a new request is not withdrawn"""
    (requester,) = alloc_accounts(1)

    request_id = make_request(request_manager, token, requester, requester, 1)

    assert not request_manager.isWithdrawn(request_id)


def test_contract_pause(request_manager, token):
    """Test that a contract can be paused"""
    (requester,) = alloc_accounts(1)
    amount = 17
    token.mint(requester, 2 * amount)

    make_request(
        request_manager,
        token,
        requester,
        requester,
        amount,
    )
    with ape.reverts("Ownable: caller is not the owner"):
        request_manager.pause(sender=requester)

    assert not request_manager.paused()
    request_manager.pause()
    assert request_manager.paused()

    with ape.reverts("Pausable: paused"):
        request_manager.pause()

    with ape.reverts("Pausable: paused"):
        make_request(
            request_manager,
            token,
            requester,
            requester,
            amount,
        )


def test_contract_unpause(request_manager, token):
    """Test that a contract can be unpaused"""
    (requester,) = alloc_accounts(1)
    amount = 17
    token.mint(requester, 2 * amount)

    with ape.reverts("Ownable: caller is not the owner"):
        request_manager.unpause(sender=requester)

    with ape.reverts("Pausable: not paused"):
        request_manager.unpause()

    request_manager.pause()
    assert request_manager.paused()
    request_manager.unpause()
    assert not request_manager.paused()

    make_request(
        request_manager,
        token,
        requester,
        requester,
        amount,
    )


def test_token_update_only_owner(request_manager, token):
    (random_guy,) = alloc_accounts(1)
    original_token_data = request_manager.tokens(token.address)
    original_transfer_limit = original_token_data.transferLimit
    new_transfer_limit = original_transfer_limit + 1
    original_eth_in_token = original_token_data.ethInToken
    new_eth_in_token = original_eth_in_token + 1

    def _assert_token_values(expected_transfer_limit, expected_eth_in_token):
        token_data = request_manager.tokens(token.address)
        assert token_data.transferLimit == expected_transfer_limit
        assert token_data.ethInToken == expected_eth_in_token

    with ape.reverts("Ownable: caller is not the owner"):
        request_manager.updateToken(
            token,
            new_transfer_limit,
            new_eth_in_token,
            sender=random_guy,
        )
    _assert_token_values(original_transfer_limit, original_eth_in_token)

    request_manager.updateToken(token, new_transfer_limit, new_eth_in_token)
    _assert_token_values(new_transfer_limit, new_eth_in_token)

    # Also show that transfer limit and eth in token can be decreased again
    request_manager.updateToken(token, original_transfer_limit, original_eth_in_token)
    _assert_token_values(original_transfer_limit, original_eth_in_token)


def test_transfer_limit_requests(request_manager, token):
    (requester,) = alloc_accounts(1)
    token_data = request_manager.tokens(token.address)
    transfer_limit = token_data.transferLimit
    eth_in_token = token_data.ethInToken

    assert token.balanceOf(requester) == 0

    make_request(request_manager, token, requester, requester, transfer_limit)
    assert token.balanceOf(requester) == 0

    with ape.reverts("Amount exceeds transfer limit"):
        make_request(request_manager, token, requester, requester, transfer_limit + 1)

    request_manager.updateToken(token, transfer_limit + 1, eth_in_token)

    make_request(request_manager, token, requester, requester, transfer_limit + 1)

    assert token.balanceOf(requester) == 0


def test_remove_chain_support(request_manager, chain_params, token):
    (requester,) = alloc_accounts(1)

    new_chain_id = 1234
    # first add the support
    request_manager.updateChain(new_chain_id, *chain_params)

    make_request(request_manager, token, requester, requester, 1, target_chain_id=new_chain_id)

    # remove support
    request_manager.updateChain(new_chain_id, 0, 0, 0)

    with ape.reverts("Target rollup not supported"):
        make_request(request_manager, token, requester, requester, 1, target_chain_id=new_chain_id)
