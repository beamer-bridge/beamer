=========================
Beamer Protocol Explainer
=========================

Introduction
------------

Beamer is a protocol to enable users to move tokens from one rollup to another. The user requests a transfer by
providing tokens on the source rollup. Liquidity providers then fill the request and directly send tokens to the user
on the target rollup.

The core focus of the protocol is to be as easy to use as possible for the end user. This is achieved through
separating two different concerns: the service provision to the end user, and the reclaiming of funds by the
liquidity provider. The service is provided optimistically as soon as the request arrives. Being refunded on the
source roll up is secured by its own mechanism and decoupled from the actual service.

Ultimately and only if necessary, any dispute can be resolved with the help of L1 providing the state from the target
rollup to the source rollup. As all rollups store their data on the same base chain, eventually state will be able to be
transmitted to each other.

Principles
----------
UX
~~

Other competitors seem to have prioritized easy implementations over user experience. For example, most bridges make
it necessary for the end user to do two transactions on two different rollups. This costs time and requires
on-boarding in advance. **We want to focus on the best possible UX**. This applies to all users in the system.

- Fast execution for the end user
- One transaction (send and receive directly)
- Fees are paid in the rollup's native coin and all funds are moved to the target rollup

The service provider (market maker, liquidity provider) needs to have predictability over the costs and gains.
Additionally, there has to be a guarantee of a refund for the service provided.

Optimistic protocol
~~~~~~~~~~~~~~~~~~~

In order to guarantee the above, the protocol is designed in an optimistic manner. The protocol is streamlined for
the optimal case where no evildoers attempt to attack it. We then make sure that anyone attacking the system will be
punished financially. The protocol also tries to make up for additional opportunity costs suffered by the victims.
This is done by forwarding the punishment to the victim. We also economically incentivize honest participants to
enforce the security of the protocol.

The protocol
------------

The protocol is separated into two games with different levels of economic incentives. Those economic incentives
interfere only slightly with each other. This model is chosen to cover the problem of economic viability of fraud 
proofs when it comes to very low amounts of earnings.


First concern: service provision
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

The process starts with the actual service provision to the user. The end user, further called Alice, will send a
request on the source rollup (A) by locking up the tokens in the `RequestManager` contract specifying how the
request can be filled.

The parameters that need to be specified by the users are:

- target chain ID
- source token address
- target token address
- recipient address on target rollup
- amount
- validity period of request

A liquidity provider, later called Bob, provides the service by directly filling the request on target rollup (B).
He now pays Alice upfront through a contract called `FillManager` and Alice receives the tokens without having to send any subsequent transactions.

Alice will pay a fee for bridging her tokens. This fee needs to cover the expense of the liquidity provider and reward
them. The fee also includes the Beamer service fee, which is used for further development of the protocol.

Security for Alice
++++++++++++++++++

Alice's main concern is having her locked tokens taken away, while not receiving bridged tokens on rollup B. This is not
possible as long as there is one honest participant who is following the game theoretic model of the challenge protocol
explained in the next section.

In any case, once she received tokens on rollup B, Alice can ignore the rest of the protocol and enjoy her bridged tokens!

If her request cannot be fulfilled by liquidity providers (e.g. amount too high, rollups sequencers offline for some time, ...),
the `validity period` argument she specified will determine for how long the request will remain open. After this period,
the request can no longer be filled and she can withdraw her locked tokens on rollup A.

Second concern: claim and challenge
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Bob will only fill a request if he is guaranteed by the protocol to receive the tokens locked by Alice on rollup A,
this is our second concern. When filling the request, Bob submits the following parameters:

- request ID
- source chain ID
- target token address
- recipient address
- amount

These parameters are useful to let other liquidity providers (or any observer) know that a request they saw on rollup A
is properly filled. The hash of these parameters, as well as the rollup B's chain ID, constitutes the `request hash`
that can later serve to prove that the request was properly filled.

::

    request hash = Hash(request ID, source chain ID, target chain ID, target token address, recipient address, amount)

When filling the request, a `fill ID` is also computed, that serves to identify a fill.

::

    fill ID = Hash(fill block number)

After filling the request, Bob will immediately claim the refund on rollup A. In doing so, he submits the `request ID`,
and `fill ID` to rollup A. This initiates a `claim period` during which the validity of the fill by Bob
can be contested or proven. Bob is required to send a deposit `claim stake` in rollup A's coin, that will be lost if
his claim is proven to be incorrect.

Since rollup A does not have direct access to the state of rollup B, we use a participative claim / challenge protocol
to optimistically determine the validity of the claim. If the optimistic approach does not conclude, a proof of the
correct fill can be passed from rollup B to rollup A via L1 for the corresponding request.

We use a cheap optimistic approach that does not require L1 to drastically reduce the costs of bridging the tokens for
Bob, and only use the more costly `L1 resolution` in case of an attack to ensure the security of the protocol.
Additionally, as we will see later, the cost of the L1 resolution will be paid by the attacker.

Rightful claims resolutions
+++++++++++++++++++++++++++

In the game theoretic case, rightful claims will not be contested. After `claim period`, Bob can withdraw his stake,
the tokens locked and the LP fee paid by Alice.

.. mermaid::
    :caption: `Unchallenged Claim`

    sequenceDiagram

    participant Alice
    participant Bob
    participant Rollup A
    participant Rollup B

    Alice->>Rollup A: requests transfer
    Bob->>Rollup A: watches for requests
    Bob->>Rollup B: fills request
    Rollup B->>Rollup B: Alice receives tokens
    Bob->>Rollup A: claims tokens
    note over Rollup A: wait for `claim period`
    Bob->>Rollup A: withdraws tokens

The rightful claim of Bob can however be challenged by anyone during its `claim period`. This will start a challenge between
him and the challenger, Charles. Charles needs to stake a deposit higher than `claim stake` to challenge Bob's claim.
The challenge will be on-going until the end of the `challenge period`.

During the challenge, the contested participant (in turn Bob, then Charles), can submit a transaction to confirm its
position and contest the other party. It is required that the new stake of the participant is higher than the current stake of the opponent.
Everytime a participant responds to the challenge, the termination time of the challenge and underlying claim is extended to be at least
`challenge period extension`, to give time for the other party to respond.

At the end of the challenge period, the last non-contested participant, and thus the participant with the highest stake, wins. The claim
will be seen as valid if the winner of the challenge game is the original claimer. This means that he will be able to
withdraw Alice's deposit.

.. mermaid::
    :caption: `Challenged Claim`

    sequenceDiagram

    participant Bob
    participant Charles
    participant Rollup A
    participant Rollup B

    Bob->> Rollup B: fills request
    Bob->>Rollup A: claims tokens

    loop
    Charles->>Rollup A: challenges Bob's claim
    Bob->>Rollup A: counter-challenges
    end

    note over Charles, Rollup A: wait for end of challenge
    Bob->>Rollup A: withdraws tokens

To avoid this challenge to go on forever, or reach a point where Bob no longer has the funds to out-stake Charles,
Bob can trigger the `L1 resolution`.

L1 resolutions
++++++++++++++

When Bob filled Alice's request, a proof was sent by the `fill manager` contract on rollup B to the outbox of
rollup B on L1. This proof is a call to a `resolver` contract on L1 and contains the following fields:

- fill hash = Hash(request hash, fill ID)
- rollup B's chain ID
- rollup A's chain ID
- Bob's address

To trigger L1 resolution, is to apply this call on L1 using the data from the rollup's outbox. This will forward the
information from the resolver to the inbox of rollup A in the form of a call to the `resolution registry` on rollup A.
This registry will store in its state a mapping from `fill hash` to `Bob`, allowing the `request manager`
to verify that a claim to fill a certain request with a certain fill ID is honest. Rollup A's chain ID is necessary for the
`resolver` contract to know to which `resolution registry` to forward the proof to. Rollup B's chain ID is used to
restrict the call to authenticated `fill manager` and `cross domain messenger` contracts.

After L1 resolution has transferred the fill information from rollup B to rollup A, Bob can directly call `withdraw` on
the `request manager` on rollup A. This will compute a `fill hash` and query the `resolution registry` for the filler
address corresponding to `fill hash`, which will return Bob's address. Bob will be immediately considered the winner of
the challenge and receive his stake as well as Charles' stake, the tokens locked by Alice, and the fees paid by Alice for the service.

The reason we need to use `fill ID = Hash(fill block number)` in the proof is to allow Charles to make sure whether the
claim by Bob is rightful. Upon submitting the claim with a certain `fill ID`, Charles can look for the block with the associated number
and see whether a fill was correctly made by Bob. Without this ID, an evildoer could claim an unfilled request and only
fill it once its claim is challenged, to gain the stake of the challenger.

.. mermaid::
    :caption: `L1 Resolution`

    sequenceDiagram

    participant Bob
    participant Charles
    participant Rollup A
    participant Rollup B
    participant L1

    Bob ->> Rollup B: fills request
    Rollup B ->> L1: registers fill proof
    Bob ->>Rollup A: claims tokens

    loop until stakes high enough for L1 resolution
    Charles ->> Rollup A: challenges Bob's claim
    Bob ->> Rollup A: counter-challenges
    end
    Charles ->> Rollup A: challenges Bob's claim
    note over Rollup A: Charles will win if we \nwait for end of challenge

    Bob ->> L1: triggers L1 resolution
    L1 ->> Rollup A: sends fill proof
    Bob ->>Rollup A: withdraws tokens

Challenging false claims
++++++++++++++++++++++++

We saw that if Bob filled Alice's claim, he will always be able to prove correctness of the fill in order to withdraw
its due from the `request manager` contract. However, if Charles falsely claims and withdraws rewards from the contract,
there will be no funds left for Bob. In order to prevent that, Bob also needs to challenge Charles' false claim.

As we saw in the previous part, Bob can use the `fill ID` provided by Charles during his claim to find out if the claim is
rightful or not. Upon seeing that it is not, Bob can challenge Charles' claim. The process will be the same as described
in the previous part about rightful claims resolutions, except that Charles will not be able to prove via L1 resolution
that his claim is rightful.

The first possible outcome is that the `challenge period` ends while Bob is ahead. In that case Bob will gain Charles'
stake and Charles will not be able to withdraw anything. In the event that Charles keeps on contesting Bob's challenges
and reaches a point where Bob no longer has enough funds to stake, Bob (or anyone else) will need to fill Alice's request
on rollup A and trigger L1 resolution for it. This will prove that the request was filled by someone other
than Charles and declare Bob as a winner of the challenge. Bob will then be rewarded for his participation by gaining
Charles' stake.

.. mermaid::
    :caption: `False Claims Challenge`

    sequenceDiagram

    participant Bob
    participant Charles
    participant Rollup A
    participant Rollup B
    participant L1

    Charles ->>Rollup A: claims tokens

    loop until stakes high enough for L1 resolution
    Bob ->> Rollup A: challanges Charles's claim
    Charles ->> Rollup A: counter-challenges
    end
    note over Rollup A: Charles will win if we \nwait for end of challenge

    Bob ->> Rollup B: fills request
    Rollup B ->> L1: registers fill proof
    Bob ->> L1: triggers L1 resolution
    L1 ->> Rollup A: sends fill proof
    Bob ->>Rollup A: withdraws tokens

Self challenges
+++++++++++++++

To make the protocol easier to reason about and implement, only two actors can participate in a challenge: the original
claimer, and the initial challenger. This raises the concern that, after submitting his false claim, Charles could challenge
himself to prevent anyone from challenging him. This would let Charlie control the state of his challenge and he would be able to
let it expire with his claim successful as an outcome.

To prevent this successful `self-challenged claim` to allow Charles to withdraw Alice's deposit, Bob can fill Alice's request
and do his own claim in parallel. If Bob's claim is not challenged and `claim period` is lower than the `challenge period`,
Bob will be able to withdraw Alice's deposit before Charles, leaving nothing for Charles to gain.

Charles can attempt to delay Bob's withdrawal by challenging Bob's rightful claim. If Charles' stake on the rightful claim
is sufficient to cover Bob's fee for L1 resolution, Bob will proceed with L1 resolution. If not, Bob can continue opening
parallel claims until Charles no longer contests one of them, or there is enough accumulated stake from Charles on the
multiple challenges for Bob to do an L1 resolution. In any case, Bob will be able to prove his rightful claim before
Charles' claim reach the end of its period.

Claims that cannot be filled
++++++++++++++++++++++++++++

In both the regular `false claim` and `self-challenge claim` cases, we assumed that Bob could fill Alice's request in
order to prove that the false claimer Charles was not the correct filler. However, If Alice's request cannot be filled
for any reason (e.g. transfer value too high), instead of proving that someone other than Charles filled a request,
Bob will need to prove that no one filled the request before a certain block height. For that, Bob needs to create and
submit an `L1 non-fill proof` from rollup B to rollup A.

.. todo::
    Exact specification TBD: https://github.com/beamer-bridge/beamer/issues/346

Fees
~~~~

Users will pay a fee for bridging their tokens. This fee needs to cover the expense of the liquidity provider and reward
them. The fees also include a Beamer service fee, which is used for further development of the protocol.

In theory, the fee should follow the formula:

::

    fee = tx fee fill + tx fee claim + tx fee withdraw funds / number of cumulative withdraws +
          opportunity cost(requested tokens, claim period) + opportunity cost(claim stake, claim period) + margin

In practice, the transaction fees depend on the current gas price, which depends on the status of the network.
Additionally, the opportunity costs can only be estimated. To have a truly faithful fee for the liquidity provider, the
user would have to register the maximum fee they are willing to pay for their transfer. This would create
a fee market where different liquidity providers would compete and accept different fees. Users would then need to query the
market for which fee they should use.

However, as the protocol intends to be as easy to use as possible, and transactions fees are mostly stable
on rollups, the protocol implements a fixed fee for every transfer. This fixed fee uses a fixed estimation of the gas
price of the rollup as well as a fixed margin for liquidity providers.


Agent strategy
--------------

`Agents` is the term we use for the software run by liquidity providers to observe the rollups, fill users' requests, and participate in
challenges. The protocol defines some rules and demonstrates how honest participation is incentivized. However, the agent
could still implement different strategies to follow the protocol. For example, the agent is free to choose the value
with which it will bid in challenges. It is also allowed to decide when to stop out-bidding opponents in challenges and
go through L1 resolution or open parallel claims.

The current implementation of the agent follows this strategy:

* Challenge a false claim `claim stake + 1`
* Challenge a claim with no filler with `cost of L1 non-fill proof`
* Subsequent counter challenge should cover the cost of L1 resolution
* Proceed with L1 resolution only when the stake of the opponent covers the cost and we are losing a challenge
* Open a parallel claim to one of our rightful claims if:
    * there is a challenged wrongful claim C for the same request and 
    * C expires before our challenged rightful claim and
    * the stake amount is not high enough for L1 resolution.

Protocol parameters
-------------------

The choice of different protocol parameters such as `claim period` or `claim stake` is explained in :ref:`contract_parameters`.

One important decision regarding parameters is not to wait for the inclusion period of rollups to consider an event as successful.
When liquidity providers fill a user request, the event regarding the successful fill is sent by the target rollup sequencer.
The liquidity provider directly sends a claim for this filled request on the source rollup and does not wait for the block
produced by the sequencer to be committed to L1.

As far as we know, it is allowed for different rollup sequencers to take as long as one week to commit their block to L1.
It could theoretically occur that after one week, the rollup commits to a block that does not result in a successful fill
of the request by the liquidity provider. To take that into account, we would need to lengthen the `claim period` parameter by
one additional week, which would result in higher opportunity costs for the liquidity provider.

In practice the longest observed delay of block inclusion from a rollup sequencer has been 18 hours, and was exceptional.
Hence the decision not to take this delay into account.

Open questions
--------------

Charles could claim a request that no one filled (or no one can fill) with a `fill ID = Hash(fill block number)`
corresponding to a block that was not produced yet. If the block is expected to be produced after `claim period` but before
the `challenge period` ends, Charles can decide to only fill the request if he is challenged.

This can be solved by using a `fill ID` that Charles cannot forge in the future such as `fill ID = Hash(previous block)`.

How do we specifically implement non-fill proofs?

.. todo::
    Exact specification TBD: https://github.com/beamer-bridge/beamer/issues/346
