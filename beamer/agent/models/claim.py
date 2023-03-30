from typing import Optional

import structlog
from eth_typing import ChecksumAddress as Address
from hexbytes import HexBytes
from statemachine import State, StateMachine
from web3.types import Timestamp, Wei

from beamer.agent.events import ClaimMade
from beamer.agent.models.request import Request
from beamer.agent.typing import ClaimId, FillId, RequestId, Termination


class Claim(StateMachine):
    def __init__(
        self,
        claim_made: ClaimMade,
        challenge_back_off_timestamp: int,
    ) -> None:
        self._log = structlog.get_logger(type(self).__name__)
        self._latest_claim_made = claim_made
        self._challenger_stakes: dict[Address, int] = {}
        self.challenge_back_off_timestamp = challenge_back_off_timestamp
        # transaction pending indicates whether a state output (transaction)
        # is pending in the chain network. If the corresponding event has
        # not arrived at the agent's EventProcessor yet, it will prevent
        # sending another transaction
        self.transaction_pending = False
        self.invalidation_tx: Optional[HexBytes] = None
        self.invalidation_timestamp: Optional[Timestamp] = None
        self.unprocessed_claim_made_events: set[ClaimMade] = set()
        super().__init__()

    started = State(initial=True)
    # Claimer is winning
    claimer_winning = State()
    # Challenger is winning
    challenger_winning = State()
    invalidated_l1_resolved = State()
    ignored = State()
    withdrawn = State()

    start_challenge = (
        started.to(claimer_winning)
        | claimer_winning.to(claimer_winning)
        | challenger_winning.to(challenger_winning)
        | invalidated_l1_resolved.to(invalidated_l1_resolved)
        | withdrawn.to(withdrawn)
    )
    challenge = (
        claimer_winning.to(challenger_winning)
        | challenger_winning.to(claimer_winning)
        | ignored.to(ignored)
    )
    l1_invalidate = (
        claimer_winning.to(invalidated_l1_resolved)
        | challenger_winning.to(invalidated_l1_resolved)
        | invalidated_l1_resolved.to(invalidated_l1_resolved)
        | withdrawn.to(withdrawn)
    )
    withdraw = (
        started.to(withdrawn)
        | claimer_winning.to(withdrawn)
        | challenger_winning.to(withdrawn)
        | ignored.to(withdrawn)
        | withdrawn.to(withdrawn)
    )
    ignore = (
        claimer_winning.to(ignored)
        | challenger_winning.to(ignored)
        | ignored.to(ignored)
        | withdrawn.to(withdrawn)
    )

    def on_enter_state(self) -> None:
        self._log.debug("Claim changed state", claim=self)

    @property
    def id(self) -> ClaimId:
        return self._latest_claim_made.claim_id

    @property
    def request_id(self) -> RequestId:
        return self._latest_claim_made.request_id

    @property
    def claimer(self) -> Address:
        return self._latest_claim_made.claimer

    @property
    def termination(self) -> Termination:
        return self._latest_claim_made.termination

    @property
    def fill_id(self) -> FillId:
        return self._latest_claim_made.fill_id

    @property
    def latest_claim_made(self) -> ClaimMade:
        return self._latest_claim_made

    def get_challenger_stake(self, challenger: Address) -> int:
        return self._challenger_stakes.get(challenger, 0)

    def add_challenger_stake(self, challenger: Address, amount: int) -> None:
        new_stake = amount + self.get_challenger_stake(challenger)
        self._challenger_stakes[challenger] = new_stake

    def valid_claim_for_request(self, request: Request) -> bool:
        claim_event = self._latest_claim_made
        if claim_event.request_id != request.id:
            return False
        if claim_event.claimer != request.filler:
            return False
        if claim_event.fill_id != request.fill_id:
            return False
        return True

    def get_winning_addresses(self) -> frozenset[Address]:
        if self._latest_claim_made.claimer_stake > self._latest_claim_made.challenger_stake_total:
            return frozenset({self.claimer})
        return frozenset(self._challenger_stakes.keys())

    def get_minimum_challenge_stake(self, initial_claim_stake: Wei) -> Wei:
        claimer_stake = self._latest_claim_made.claimer_stake
        challenger_stake = self._latest_claim_made.challenger_stake_total

        if challenger_stake > claimer_stake:
            return Wei(challenger_stake - claimer_stake + initial_claim_stake)
        else:
            return Wei(claimer_stake - challenger_stake + 1)

    def on_start_challenge(
        self,
        invalidation_tx: HexBytes | None = None,
        invalidation_timestamp: Timestamp | None = None,
    ) -> None:
        self.invalidation_tx = invalidation_tx
        self.invalidation_timestamp = invalidation_timestamp

    def on_challenge(self, new_claim_made: ClaimMade) -> None:
        self._on_new_claim_made(new_claim_made)

    def on_withdraw(self) -> None:
        self.transaction_pending = False

    def on_ignore(self, new_claim_made: Optional[ClaimMade] = None) -> None:
        if new_claim_made is None:
            self._on_new_claim_made(self._latest_claim_made)

    def _on_new_claim_made(self, new_claim_made: ClaimMade) -> None:
        assert self._latest_claim_made.claim_id == new_claim_made.claim_id
        assert self._latest_claim_made.fill_id == new_claim_made.fill_id

        if new_claim_made.challenger_stake_total > new_claim_made.claimer_stake:
            new_challenger_stake = (
                new_claim_made.challenger_stake_total
                - self._latest_claim_made.challenger_stake_total
            )
            self.add_challenger_stake(new_claim_made.last_challenger, new_challenger_stake)

        self._latest_claim_made = new_claim_made
        self.transaction_pending = False

    def __repr__(self) -> str:
        state = self.current_state.id
        return f"<Claim id={self.id} state={state} request_id={self.request_id!r}>"
