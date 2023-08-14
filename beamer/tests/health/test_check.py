import dataclasses
import pickle
import time

from web3.types import Wei

from beamer.health.check import (
    ChainEventMap,
    Context,
    NotificationTypes,
    Transfer,
    analyze_transfer,
    create_transfers_object,
)
from beamer.tests.agent.unit.util import CLAIM_ID, REQUEST_ID
from beamer.tests.health.conftest import SOURCE_CHAIN_ID, TARGET_CHAIN_ID
from beamer.tests.util import make_address
from beamer.typing import Termination


def test_create_transfers_object(transfer_request, transfer_claim, transfer_fill):
    events_grouped_by_chain_id: ChainEventMap = {
        SOURCE_CHAIN_ID: [transfer_request, transfer_claim],
        TARGET_CHAIN_ID: [transfer_fill],
    }

    transfers = create_transfers_object(events_grouped_by_chain_id)

    assert transfers[REQUEST_ID.hex()]["created"] == transfer_request
    assert transfers[REQUEST_ID.hex()]["filled"] == transfer_fill
    assert transfers[REQUEST_ID.hex()]["claimed"][CLAIM_ID] == [transfer_claim]


def test_check_for_request_created(ctx, transfer_request):
    transfer: Transfer = {
        "created": transfer_request,
    }

    analyze_transfer(transfer, ctx)

    assert ctx.stats.requests == 1


def test_check_if_request_has_fill_with_no_request_created(ctx, transfer_fill):
    transfer: Transfer = {
        "filled": transfer_fill,
    }

    analyze_transfer(transfer, ctx)

    assert ctx.stats.fills == 0
    assert ctx.stats.expired_requests == 0


def test_check_if_request_has_fill_with_request_created(ctx, transfer_request, transfer_fill):
    transfer: Transfer = {
        "created": transfer_request,
        "filled": transfer_fill,
    }

    analyze_transfer(transfer, ctx)
    assert ctx.stats.fills == 1
    assert ctx.stats.expired_requests == 0


def test_check_if_request_has_fill_with_no_fill_and_request_created_not_expired(
    ctx, transfer_request
):
    transfer: Transfer = {
        "created": dataclasses.replace(
            transfer_request, valid_until=Termination(int(time.time() + 1000))
        ),
    }

    analyze_transfer(transfer, ctx)

    assert ctx.stats.fills == 0
    assert ctx.stats.unfilled_requests == 1


def test_check_if_request_has_fill_with_no_fill_and_request_created_has_expired(
    ctx, transfer_request
):
    transfer: Transfer = {
        "created": transfer_request,
    }

    analyze_transfer(transfer, ctx)

    assert ctx.stats.fills == 0
    assert ctx.stats.expired_requests == 1


def test_check_if_claim_is_made_for_fill_no_request():
    ctx = Context()
    original = pickle.dumps(ctx)

    transfer: Transfer = {}

    analyze_transfer(transfer, ctx)

    assert original == pickle.dumps(ctx)


def test_check_if_claim_is_made_for_fill_no_fill(transfer_request):
    ctx = Context()
    transfer: Transfer = {
        "created": dataclasses.replace(
            transfer_request, valid_until=Termination(int(time.time() + 1000))
        ),
    }

    analyze_transfer(transfer, ctx)

    assert len(ctx.notifications) == 1
    assert ctx.notifications[0]["meta"]["message_type"] == NotificationTypes.REQUEST_UNFILLED


def test_check_if_claim_is_made_for_fill_no_there_is_a_claim(
    transfer_request, transfer_fill, transfer_claim
):
    ctx = Context()
    transfer: Transfer = {
        "created": transfer_request,
        "filled": transfer_fill,
        "claimed": {int(transfer_claim.claim_id): [transfer_claim]},
    }

    analyze_transfer(transfer, ctx)

    assert ctx.stats.claims == 1


def test_check_if_claim_is_made_for_fill_when_there_is_no_claim(transfer_request, transfer_fill):
    ctx = Context()

    transfer: Transfer = {
        "created": transfer_request,
        "filled": transfer_fill,
    }

    analyze_transfer(transfer, ctx)

    assert len(ctx.notifications) == 0


def test_check_if_claim_is_made_for_fill_when_there_is_no_claim_and_request_hasnt_expired(
    ctx, transfer_request, transfer_fill
):
    transfer: Transfer = {
        "created": dataclasses.replace(
            transfer_request, valid_until=Termination(int(time.time() + 1000))
        ),
        "filled": transfer_fill,
    }

    analyze_transfer(transfer, ctx=ctx)

    assert len(ctx.notifications) == 1
    assert ctx.notifications[0]["meta"]["message_type"] == NotificationTypes.UNCLAIMED_FILL


def test_check_if_challenge_game_no_challenge(
    ctx, transfer_request, transfer_fill, transfer_claim
):
    transfer: Transfer = {
        "created": transfer_request,
        "filled": transfer_fill,
        "claimed": {int(transfer_claim.claim_id): [transfer_claim]},
    }

    analyze_transfer(transfer, ctx)
    assert len(ctx.notifications) == 0


def test_check_if_challenge_game_one_challenge(
    ctx, transfer_request, transfer_fill, transfer_claim
):
    transfer: Transfer = {
        "created": transfer_request,
        "filled": transfer_fill,
        "claimed": {
            int(transfer_claim.claim_id): [
                transfer_claim,
                dataclasses.replace(
                    transfer_claim, last_challenger=make_address(), challenger_stake_total=Wei(1)
                ),
            ]
        },
    }

    analyze_transfer(transfer, ctx)

    assert len(ctx.notifications) == 1
    assert ctx.notifications[0]["meta"]["message_type"] == NotificationTypes.CHALLENGE_GAME


def test_check_if_challenge_game_claim_by_someone_else(
    ctx, transfer_request, transfer_fill, transfer_claim, evil_agent_address
):
    evil_claim = dataclasses.replace(
        transfer_claim, claim_id=CLAIM_ID + 1, claimer=evil_agent_address
    )

    transfer: Transfer = {
        "created": transfer_request,
        "filled": transfer_fill,
        "claimed": {int(evil_claim.claim_id): [evil_claim]},
    }

    analyze_transfer(transfer, ctx)

    assert len(ctx.notifications) == 1
    assert (
        ctx.notifications[0]["meta"]["message_type"]
        == NotificationTypes.CHALLENGE_GAME_CLAIMED_BY_SOMEONE_ELSE
    )


def test_check_if_challenge_game_one_challenge_and_one_false_claim(
    ctx, transfer_request, transfer_fill, transfer_claim, evil_agent_address
):
    evil_claim = dataclasses.replace(
        transfer_claim, claim_id=CLAIM_ID + 1, claimer=evil_agent_address
    )

    transfer: Transfer = {
        "created": transfer_request,
        "filled": transfer_fill,
        "claimed": {
            int(transfer_claim.claim_id): [
                transfer_claim,
                dataclasses.replace(
                    transfer_claim, last_challenger=make_address(), challenger_stake_total=Wei(1)
                ),
            ],
            int(evil_claim.claim_id): [evil_claim],
        },
    }
    analyze_transfer(transfer, ctx)

    assert len(ctx.notifications) == 2
    assert ctx.notifications[0]["meta"]["message_type"] == NotificationTypes.CHALLENGE_GAME
    assert (
        ctx.notifications[1]["meta"]["message_type"]
        == NotificationTypes.CHALLENGE_GAME_CLAIMED_BY_SOMEONE_ELSE
    )


def test_check_if_challenge_game_multiple_challenges(
    ctx, transfer_request, transfer_fill, transfer_claim, evil_agent_address
):
    evil_claim = dataclasses.replace(
        transfer_claim, claim_id=CLAIM_ID + 1, claimer=evil_agent_address
    )

    transfer: Transfer = {
        "created": transfer_request,
        "filled": transfer_fill,
        "claimed": {
            int(transfer_claim.claim_id): [
                transfer_claim,
                dataclasses.replace(
                    transfer_claim, last_challenger=make_address(), challenger_stake_total=Wei(1)
                ),
            ],
            int(evil_claim.claim_id): [
                evil_claim,
                dataclasses.replace(
                    evil_claim, last_challenger=make_address(), challenger_stake_total=Wei(1)
                ),
            ],
        },
    }

    analyze_transfer(transfer, ctx)

    assert len(ctx.notifications) == 2
    assert ctx.notifications[0]["meta"]["message_type"] == NotificationTypes.CHALLENGE_GAME
    assert ctx.notifications[1]["meta"]["message_type"] == NotificationTypes.CHALLENGE_GAME
