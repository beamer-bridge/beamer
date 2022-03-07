============
Raisync node
============

Introduction
------------

Raisync is a protocol to allow users to move funds from one roll up to another. This is achieved by matching the requester and the service provider who provides the funds on the target chain. The protocol chose to be roll up agnostic only for now as Ethereum announced a roll up centric road map.

The main advantage is achieved through separation of providing the service to the end user and reclaiming the funds into two separated games. The service is provided as soon as the request arrives optimistically. Being refunded on the source roll up is secured in a new game and decoupled from the actual service.

Ultimately and if necessary, any dispute will be resolved eventually with the help of L1 providing the state from the target roll up to the resolver. As all roll ups live on the same base chain, eventually state will be able to transmitted to each other. 


Principles
----------
UX
~~

Other competitors seem to have easy implementations but lack in UX for the end user like making it necessary for the end user to do two transactions on two different rollups. This costs time and requires on boarding in advance.
**We want to focus on the best possible UX**. This accounts for all users in the system.
* Fast execution for the end user
* One transaction (send and receive directly)

The service provider aka market maker needs to have predictability over the costs and gains as well as the security to be refunded for the service he provided.

Optimistic protocol
-------------------

In order to guarantee the above, the protocol is designed in an optimistic manner. Derived from optimistic protocols, each participant can validate the state himself whereas the base chain needs to wait for finality.
At first, contracts will have to "trust" the users which submit transactions. By challenge periods, false behavior can be challenged. This will pause the transaction flow and enter into a new game.
Challenged interactions will be ultimately resolved on the base chain, as the base chain has the knowledge of all roll ups' states.
This makes the protocol fast and easy to use in the normal case. The downside is, that security guarantees depend on the availability of the watchers which will challenge false behavior.

The Protocol
------------

The protocol is separated into games with different levels of economic incentives. Those economic incentives interfere only slightly with each other. This model is chosen to cover the problem of economic viability of fraud proofs when it comes to very low amounts of earnings.


Game 1: Service Provision
~~~~~~~~~~~~~~~~~~~~~~~~~

The process starts with the actual service provision of its use case. 
The end user, also called Alice, will send a request on the source Roll Up (A) by locking up the tokens in the RequestManager contract with specified data how the request can be filled.
A market maker, later called Bob is willing to fulfill the service by directly filling the request on target roll up (B). He now pays Alice upfront and fills the request. He can only do this if he knows for sure that he will be refunded with the tokens on roll up (A).
After filling the request Bob will claim the refund. It initiates the claim period. Since the RequestManager contract on roll up A does not know who filled the request, there needs to be a period in which other honest participants could step in and challenge the honesty of Bob. Anybody can call the claim. Bob will have to put a safety deposit which he will risk to lose if he did not actually do what he claimed for. This will be described later on in Game 2.
Once the claim period ends and nobody challenged his claim, his refund is final and he is allowed to withdraw. This can be accumulated for multiple claims.

Constraints
+++++++++++

Fees: Fee model is roughly calculated as such: `txfee_fill_rollup_B + tx_fee_claim_rollup_A + tx_fee_withdraw_rollup_A / accumulated_withdraws + opportunity_cost(requested_tokens, claim period) + opportunity_cost(safety_deposit, claim_period) + margin`

claim period: Must be long enough for other participants to verify roll up Bs state and challenge the claim. Claim must be included in roll up A.


Game 2: Claim and Challenge
~~~~~~~~~~~~~~~~~~~~~~~~~~~

The claim and Challenge game (C&C) is a game between the claimer and a challenger to keep the network healthy. This means that false claims, which are possible in the protocol, will be declined before the funds are being paid out and are lost. The original service provider will be refunded eventually. The incentives must be chosen in a way that the following statements are true:

- Not saying the truth, for either claimer or challenger will lead to a loss of funds if both participants follow the protocol.
- Griefing attacks are economically viable for the victim. This means griefing attacks are desired and do not harm the victim.

The claim and challenge mechanism is a hybrid version based on an escalation mechanism described in https://forum.gnosis.io/t/the-ultimate-oracle/61 and state validation of roll ups on L1. The reason why the escalation mechanism is in place is to collect funds for an expensive on chain dispute resolution where the final states of the roll ups will be compared to discover the truth.
As described above, Bob claims the refund tokens on the source rollup (A). He does this by calling the `claim(...)` function on the `RequestManager` contract.

Claiming starts the claim period, during which watchers can challenge the claim. For the prototype this process is only involving the claimer and the challenger. But we should think about allowing third-parties to join the process.

The claim has to include a safety deposit which can either be provided with the request, or by reusing a non-withdrawn former claim. The safety deposit is payed in ETH. The reason for the safety deposit is to have some incentivization for the watcher to challenge. Since all participants know the state of roll up B, the watcher can claim safely and has the safety deposit to win. *The amount of the safety deposit has to be high enough to incentivize the watcher to challenge*.

The goal of the challenge process is to collect enough balance to pay for a possible resolution on L1. This is is done by an alternating process of bidding. A bid is placed by calling the `challenge(...)` function on the `RequestManager` contract. This challenge included a bid that must be equal or higher than the safety deposit in the claim. This prevents a griefing attack locking up the safety deposit from Bob.

Now, alternating, the claimer and the challenger can increase their challenge amounts, until one of two things happens:
1. One stops bidding and loses all of its bid funds once the challenge deadline is passed.
2. The collected amount is big enough that one of both decides to go onto L1 and ask the `DisputeResolver` contract to resolve the dispute.

In case 1, the sender of the last challenge wins, and can withdraw the challenge deposits of the bidding game. In this case the C&C ends without the resolution of the actual claim. This is not bad as the amount won in the bidding game is enough to have joined the game.

In case 2, the `DisputeResolver` contract posts a message to the rollups message box. This is then used in `withdraw` call (on L2) to verify that the caller is entitled to the funds. The DisputeResolver will check the state of roll up B and can verify if and who filled Alice's request. The sent message not only resolves the C&C it also resolves who is eligible to withdraw the funds. It resolves game 1 as well as game 2.

During the challenge process the exit period gets extended to allow the other side time to react. It has however, to at least cover the exit period of the other rollups, so it can be calculated with `max(exit L2 B, last point of challenge + 1 day)`. 

Constraints
~~~~~~~~~~~

Contraints are a bit higher here to stay incentive aligned

- Safety deposit: The safety deposit must be high enough that it makes sense for the challenger to challenge a claim. Limited by tx_fee + operational costs. Safety deposit should be chosen by the protocol.
- Exit Period: Exit period is the exit period of roll up B starting from receiving the claim transaction
- Challenge Period: Challenge period must be at least Exit Period  + X where X must be large enough to either counter challenge or resolve the dispute on L1.
    - Each bid will increase the Challenge period by `max(current_challenge_period, now + X)`. This ensures to give the opponent the time to counter challenge or resolve.
- Each bid must increase the own safety deposit to be equal or higher than the amount of the opponents total stake 

Sequence diagrams
-----------------

Happy case (Game 1)
-------------------

.. mermaid::

  sequenceDiagram
    participant User
    Market Maker -> Roll-up A: Watches for requests
    User -> Roll-up A: Sends transfer request
    Market Maker -> Roll-up B: Fills request
    Market Maker -> Roll-up A: Claims tokens
    Note over Market Maker: Wait until end of claim period
    Market Maker -> Roll-up A: Withdraws tokens

Non-L1 Challenge (Game 2)
-------------------------

.. mermaid::

  sequenceDiagram
    participant User
    participant Market Maker
    User -> Roll-up A: Sends transfer request
    Market Maker -> Roll-up A: Claims tokens
    
    Note over Roll-up A: Challenge period starts
    
    Challenger -> Roll-up A: Challenges
    Market Maker -> Roll-up A: Challenges
    Challenger -> Roll-up A: Challenges

    Note over Roll-up A: Challenge period ends
    Challenger -> Roll-up A: Withdraws challenge price

L1-based Challenge (Game 2)
---------------------------

.. mermaid::

  sequenceDiagram
    participant User
    participant Market Maker

    Market Maker -> Roll-up A: Watches for requests
    User -> Roll-up A: Sends transfer request
    Market Maker -> Roll-up B: Fills request
    Market Maker -> Roll-up A: Claims tokens
    
    Note over Roll-up B: Challenge period starts
    
    Challenger -> Roll-up A: Challenges (adversarial)
    Market Maker -> Roll-up A: Challenges
    Challenger -> Roll-up A: Challenges

    Note over Roll-up B: Market Maker now has enough funds to go to L1
    Note over Roll-up B: Calldata for claim filling pushed to L1
    
    Market Maker -> L1: Calls resolution contract
    L1 -> Roll-up A: Sends message with resolution to inbox
    Challenger -> Roll-up A: Withdraws challenge price

Contracts
---------

`RequestManager` (L2)
~~~~~~~~~~~~~~~~~~~~~

- `request(chain_id, token_address, amount, target_address) -> request_id`
    - Can we make it possible to trigger arbitrary contract calls here?
    - Execution of contract functions can be done in later milestones
- `claim(request_id) -> claim_id`
    - multiple claims can exist for any request. Internally they are identified by the `(claim_id, claimer_address)` tuple.
- `challenge(claim_id, challenge_amount)`
- `withdraw(claim_id, target_address)`
    - Transfers the claimed funds to the target address
    - If there was a dispute, also transfers the bid amounts
    - ???: withdraw in different tokens by calling uniswap?

Constants:
- challenge period
- exit period of other rollup (+ margin)
- period extension time

`DisputeResolver` (L1)
~~~~~~~~~~~~~~~~~~~~~~

- `resolve()` TBD
    - See https://developer.offchainlabs.com/docs/l1_l2_messages#arbitrum-to-ethereum
    - Send message from L2 to L1 (`ArbSys.sendTxToL1`), returns unique id
    - Get calldata from L2 (`NodeInterface.lookupMessageBatchProof`)

Open questions
++++++++++++++

- Transfer request details
- L1 resolution request details
- Challenge period length
- re-challenge period equal or different to initial challenge period
- gas price on optimism?
- bulk claim?
- Assuming Bob submitted a claim and Charlie sent a challenge,
  can a third-party, e.g. Dave, join the challenge game and vote for
  either side? If so, what are the requirements that Dave needs to fulfill
  to join the game (fees, ...)?
- Sender of latest challenge doesn't need to go on-chain

Testing setup
===============

- one private chain, C
- Arbitrum and Optimism running on top of C
- two Raisync nodes, acting as Bob1 and Bob2
- a way to define and run a "scenario"

Test cases
----------

1. happy-case (no challenges)
   - Alice sends a transfer request
   - Bob1 fulfills the request
   - Bob1 submits a claim
   - Bob1 gets the tokens after the challenge period expires

2. challenge-countered
   - Alice sends a transfer request
   - Bob1 fulfills the request
   - Bob1 submits a claim
   - Bob2 submits a challenge
   - Bob1 submits a counter-challenge
   - Bob2 does not respond further
   - Bob1 gets the tokens after the challenge period expires
   
3. false-claim
   - Alice sends a transfer request
   - Bob1 submits a false claim (he did not fulfill the request)
   - Bob2 submits a challenge
   - Bob1 does not respond further
   - Bob2 gets the  Bob1's deposit after the challenge period expires
      
Tech Stack
----------

General
-------

- Monorepo

Contracts
---------

- eth-brownie
- Use building blocks from openzeppelin etc.

"RaiSync Node" / Backend / THE BOB
----------------------------------

- Language: Python 
    - Poetry
    - AsyncIO, preferrably Trio
    - [Sqlmodel](https://github.com/tiangolo/sqlmodel) (Model library based on [pydantic](https://github.com/samuelcolvin/pydantic) that is directly compatible with both SQLAlchemy and [FastAPI](https://fastapi.tiangolo.com))
        - Probably needs [trio-asyncio](https://github.com/python-trio/trio-asyncio) to bridge to sqlalchemy asyncio
    - Web3 interface?
        - No ready made async (and esp. trio) compatible library seems to be available.
        - Possible solution: Use lower level libraries (eth-abi etc.) to encode calls and do network requests "manually" via trio
- Database: SQLite

Open questions
--------------

- Sending ETH to contracts can be costly
    - Contracts can override the function to receive ETH
    - could be arbitrary cost of gas
    - Quick Solution: Only allow ERC20 transfers

- Future improvements
    - zk SNARKs
    - https://ethresear.ch/t/cross-rollup-nft-wrapper-and-migration-ideas/10507


Small competitor comparison
---------------------------


HTLCs (Connext, celer)
~~~~~~~~~~~~~~~~~~~~~~

Better UX than HTLCs - Only 1 transaction from end users perspective, no onboarding to target roll up needed in advance, faster


Hop
~~~

More capital efficient than hop - Hop has AMM with 2* ETH on each roll up + Bonder needs to stake ETH to move funds from L2 to L2
Raisync has 1* ETH for each roll up , staking only during claim period
Raisync has a clear predictable fee calculation model
Raisync is completely trustless as opposed to Hop network trusted set of Bonders (Currently 1 Bonder)

Raisync relies on having multiple participants, at least one honest participant
