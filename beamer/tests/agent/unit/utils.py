from pathlib import Path
from typing import Tuple
from unittest.mock import MagicMock

from eth_account import Account
from eth_typing import BlockNumber, ChecksumAddress
from eth_utils import to_checksum_address
from hexbytes import HexBytes
from web3.constants import ADDRESS_ZERO
from web3.types import BlockData, Timestamp, Wei

from beamer.config import Config
from beamer.events import ClaimMade
from beamer.models.claim import Claim
from beamer.models.request import Request
from beamer.state_machine import Context
from beamer.tests.agent.utils import make_address
from beamer.tests.constants import FILL_ID
from beamer.tracker import Tracker
from beamer.typing import URL, ChainId, ClaimId, FillId, RequestId, Termination, TokenAmount
from beamer.util import TokenMatchChecker

SOURCE_CHAIN_ID = ChainId(2)
TARGET_CHAIN_ID = ChainId(3)

REQUEST_ID = RequestId(10)
CLAIM_ID = ClaimId(200)

CLAIMER_STAKE = Wei(10_000_000)
CHALLENGER_STAKE = Wei(5_000_000)
ZERO_STAKE = Wei(0)

TERMINATION = Termination(1)
TIMESTAMP = Timestamp(457)
BLOCK_NUMBER = BlockNumber(12345)

ACCOUNT = Account.from_key(0xB25C7DB31FEED9122727BF0939DC769A96564B2DE4C4726D035B36ECF1E5B364)
ADDRESS1 = make_address()
NULL_ADDRESS = to_checksum_address("0x0000000000000000000000000000000000000000")


class MockEth:
    def __init__(self, chain_id):
        self.chain_id = chain_id

    wait_for_transaction_receipt = MagicMock()


class MockWeb3:
    def __init__(self, chain_id):
        self.eth = MockEth(chain_id=chain_id)


def make_request(valid_until: int = TIMESTAMP - 1) -> Request:
    return Request(
        request_id=REQUEST_ID,
        source_chain_id=SOURCE_CHAIN_ID,
        target_chain_id=TARGET_CHAIN_ID,
        source_token_address=make_address(),
        target_token_address=make_address(),
        target_address=make_address(),
        amount=TokenAmount(123),
        valid_until=valid_until,
    )


def make_claim_unchallenged(
    request: Request,
    claim_id: ClaimId = CLAIM_ID,
    claimer: ChecksumAddress = None,
    claimer_stake: Wei = CLAIMER_STAKE,
    fill_id: FillId = FILL_ID,
    termination: Termination = TERMINATION,
    stay_in_started_state: bool = False,
) -> Claim:
    return make_claim_challenged(
        request=request,
        claim_id=claim_id,
        claimer=claimer,
        claimer_stake=claimer_stake,
        challenger=to_checksum_address(ADDRESS_ZERO),
        challenger_stake=Wei(0),
        fill_id=fill_id,
        termination=termination,
        stay_in_started_state=stay_in_started_state,
    )


def make_claim_challenged(
    request: Request,
    claim_id: ClaimId = CLAIM_ID,
    claimer: ChecksumAddress = None,
    claimer_stake: Wei = CLAIMER_STAKE,
    challenger: ChecksumAddress = None,
    challenger_stake: Wei = CHALLENGER_STAKE,
    fill_id: FillId = FILL_ID,
    termination: Termination = TERMINATION,
    stay_in_started_state: bool = False,
) -> Claim:
    claimer = claimer or make_address()
    challenger = challenger or make_address()

    claim = Claim(
        claim_made=ClaimMade(
            chain_id=request.source_chain_id,
            tx_hash=HexBytes(b""),
            claim_id=claim_id,
            request_id=request.id,
            fill_id=fill_id,
            claimer=claimer or make_address(),
            claimer_stake=claimer_stake,
            last_challenger=challenger,
            challenger_stake_total=challenger_stake,
            termination=termination,
            block_number=BLOCK_NUMBER,
        ),
        challenge_back_off_timestamp=123,
    )
    claim.add_challenger_stake(challenger, challenger_stake)

    if not stay_in_started_state:
        # In a challenged state, the claim must be in the challenge game states
        claim.start_challenge()

        if (
            claim.is_claimer_winning  # pylint:disable=no-member
            and challenger_stake > claimer_stake
        ):
            claim.challenge(claim.latest_claim_made)

    return claim


def make_context() -> Tuple[Context, Config]:
    checker = TokenMatchChecker([])
    config = Config(
        account=ACCOUNT,
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
                    "timestamp": TIMESTAMP,
                }
            )
        },
        config=config,
        web3_l1=MagicMock(),
        task_pool=MagicMock(),
        l1_resolutions={},
    )
    context.request_manager.functions.claimStake().call.return_value = 1  # type: ignore
    return context, config
