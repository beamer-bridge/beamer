from typing import Optional

from eth_typing import ChecksumAddress as Address
from statemachine import State, StateMachine
from web3.types import Wei

from beamer.events import ClaimMade
from beamer.models.request import Request
from beamer.typing import ClaimId, RequestId, Termination


class Claim(StateMachine):
    def __init__(
        self,
        claim_made: ClaimMade,
        challenge_back_off_timestamp: int,
    ) -> None:
        super().__init__()
        self._latest_claim_made = claim_made
        self.challenge_back_off_timestamp = challenge_back_off_timestamp
        # transaction pending indicates whether a state output (transaction)
        # is pending in the chain network. If the corresponding event has
        # not arrived at the agent's EventProcessor yet, it will prevent
        # sending another transaction
        self.transaction_pending = False

    # Claimer is winning
    claimer_winning = State("ClaimerWinning", initial=True)
    # Challenger is winning
    challenger_winning = State("ChallengerWinning")
    ignored = State("Ignored")
    withdrawn = State("Withdrawn")

    challenge = (
        claimer_winning.to(challenger_winning)
        | challenger_winning.to(claimer_winning)
        | ignored.to(ignored)
    )
    withdraw = (
        claimer_winning.to(withdrawn) | challenger_winning.to(withdrawn) | ignored.to(withdrawn)
    )
    ignore = claimer_winning.to(ignored) | ignored.to(ignored)

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
    def challenger(self) -> Address:
        return self._latest_claim_made.challenger

    @property
    def termination(self) -> Termination:
        return self._latest_claim_made.termination

    def valid_claim_for_request(self, request: Request) -> bool:
        claim_event = self._latest_claim_made
        if claim_event.request_id != request.id:
            return False
        if claim_event.claimer != request.filler:
            return False
        if claim_event.fill_id != request.fill_id:
            return False
        return True

    def get_winning_address(self) -> Address:
        if self._latest_claim_made.claimer_stake > self._latest_claim_made.challenger_stake:
            return self.claimer
        return self.challenger

    def get_next_challenge_stake(self, initial_claim_stake: Wei) -> Wei:
        claimer_stake = self._latest_claim_made.claimer_stake
        challenger_stake = self._latest_claim_made.challenger_stake

        if challenger_stake == 0:
            # we challenge with enough stake for L1 resolution
            return Wei(initial_claim_stake + 10 ** 15)
        if challenger_stake > claimer_stake:
            return Wei(challenger_stake - claimer_stake + initial_claim_stake)
        else:
            return Wei(claimer_stake - challenger_stake + 1)

    def on_challenge(self, new_claim_made: ClaimMade) -> None:
        self._on_new_claim_made(new_claim_made)

    def on_withdraw(self) -> None:
        self.transaction_pending = False

    def on_ignore(self, new_claim_made: Optional[ClaimMade] = None) -> None:
        if new_claim_made is None:
            self._on_new_claim_made(self._latest_claim_made)

    def _on_new_claim_made(self, new_claim_made: ClaimMade) -> None:
        self._latest_claim_made = new_claim_made
        self.transaction_pending = False

    def __repr__(self) -> str:
        state = self.current_state.identifier
        return f"<Claim id={self.id} state={state} request_id={self.request_id}>"
