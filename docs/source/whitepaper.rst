=========================
Beamer Protocol Explainer
=========================

Introduction
------------

Beamer is a protocol to enable users to move tokens from one roll-up to another. The user requests a transfer by
providing tokens on the source roll-up. Liquidity providers then fill the request and directly send tokens to the user
on the target roll-up.

The core focus of the protocol is to be as easy to use as possible for the end user. This is achieved through
separating two different concerns: the service provision to the end user, and the reclaiming of funds by the
liquidity provider. The service is provided as soon as the request arrives optimistically. Being refunded on the
source roll up is secured in a second game and decoupled from the actual service.

Ultimately and only if necessary, any dispute can be resolved with the help of L1 providing the state from the target
roll up to the source roll-up. As all roll ups live on the same base chain, eventually state will be able to be
transmitted to each other.


Principles
----------
UX
~~

Other competitors seem to have prioritized easy implementations over user experience. For example, most bridges make
it necessary for the end user to do two transactions on two different roll-ups. This costs time and requires
on-boarding in advance. **We want to focus on the best possible UX**. This accounts for all users in the system.

- Fast execution for the end user
- One transaction (send and receive directly)

The service provider (market maker, liquidity provider) needs to have predictability over the costs and gains.
Additionally, it has to be guaranteed to be refunded for the service he provided.

Optimistic protocol
~~~~~~~~~~~~~~~~~~~

In order to guarantee the above, the protocol is designed in an optimistic manner. The protocol is streamlined for
the optimal case where no evildoers attempt to attack it. We then make sure that anyone attacking the system can be
punished financially. We also economically incentivize honest participant to enforce the security of the
protocol.

The Protocol
------------

The protocol is separated into games with different levels of economic incentives. Those economic incentives 
interfere only slightly with each other. This model is chosen to cover the problem of economic viability of fraud 
proofs when it comes to very low amounts of earnings.


First concern: service provision
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

The process starts with the actual service provision to the user. The end user, further called Alice, will send a
request on the source roll-up (A) by locking up the tokens in the `RequestManager` contract specifying how the
request can be filled.

The parameters that need to be specified by the users are:

- target chain ID
- source token address
- target token address
- recipient address on target roll-up
- amount
- validity period of request

A liquidity provider, later called Bob fulfills the service by directly filling the request on target roll-up (B).
He now pays Alice upfront and Alice receives the tokens without having to send any subsequent transactions.

Alice will pay a fee for bridging her tokens. This fee needs to cover the expense of the liquidity provider and reward
them. The fee also include a protocol fee, rewarding builders of the protocol.

Security for Alice
++++++++++++++++++

Alice's main concern is having her locked tokens taken away, while not receiving bridged tokens on roll-up B. This is not
possible as long as there is one honest, or game theoretic, participant in the challenge protocol explained in the next section.

In any case, once she received tokens on roll-up B, Alice can ignore the rest of the protocol and enjoy her bridged tokens!

If her request cannot be fulfilled by liquidity providers (e.g. amount too high, roll-ups sequencers offline for some time, ...),
the `validity period` argument she specified will determine for how long the request will remain open. After this period,
the request can no longer be filled and she can withdraw her locked token on roll-up A.

Second concern: Claim and Challenge
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Bob will only fill a request if he is guaranteed by the protocol to receive the tokens locked by Alice on roll-up A,
this is our second concern. When filling the request, Bob submits the following parameters:

- request ID
- source chain ID
- target token address
- recipient address
- amount

These parameters are useful to let other liquidity providers (or any observer) know that a request they saw on roll-up A
is properly filled. The hash of these parameters, as well as the roll-up B's chain ID, constitutes the `request hash`
that can later serve to prove that the request was properly filled.

::

    request hash = Hash(request ID, source chain ID, target chain ID, target token address, recipient address, amount)

When filling the request, a `fill ID` is also computed, that serves to identify a request for every observers.

::

    fill ID = Hash(fill block number)

Bob is also required to send a deposit `claim stake` of roll-up A's coin, that will be lost if his claim is proven
to be incorrect.

After filling the request, Bob will immediately claim the refund on roll-up A. In doing so, he submits the `request ID`,
and `fill ID` computed before to roll-up A. This initiates a `claim period` during which the validity of the fill by Bob
can be contested or proven.

Since roll-up A does not have direct access to the state of roll-up B, we use a participative claim / challenge protocol
to optimistically determine the validity of the claim. If the optimistic approach does not conclude, a proof can
be passed from roll-up to B to roll-up A via L1 of the correct fill for the corresponding request.

We use a cheap optimistic approach that does not require L1 to drastically reduce the costs of bridging the token for
Bob, and only use the more costly `L1 resolution` in case of an `attack` to ensure the security of the protocol.
Additionally, as we will see later, the cost of the L1 resolution will be paid by the attacker.

Rightful claims resolutions
+++++++++++++++++++++++++++

In the game theoretic case, rightful claims will not be contested. After `claim period`, Bob can withdraw its stake, the
tokens locked by Alice, and the fees paid by Alice for the service.

The rightful claim of Bob can however be challenged by anyone during its `claim period`. This will start a challenge in between
him and the challenger, Charles. Charles needs to stake a deposit higher than `claim stake` to challenge Bob's claim.
The challenge will be on-going until the end of the `challenge period`.

During the challenge, the contested participant (in turn Bob, then Charles), can submit a transaction to confirm its
position and contest the other party. It is required that the new stake of the participant is bigger than the current stake of the opponent.
Everytime a participant responds to the challenge, the termination time of the challenge and underlying claim is extended to be at least
`challenge period extension` to give time for the other party to respond.

At the end of the challenge period, the last non-contested participant, and thus the highest staker, wins.

To avoid this challenge to go on forever, or reach a point where Bob no longer have the funds to out-stake Charles,
Bob can trigger the `L1 resolution`.

L1 resolutions
++++++++++++++

When Bob filled Alice's request, a proof was sent by the `fill manager` contract on roll-up B to the outbox of
roll-up B on L1. This proof is a call to a `resolver` contract on L1 and contains the following fields:

- fill hash = Hash(request hash, fill ID)
- roll-up A's chain ID
- roll-up B's chain ID
- Bob's address

To trigger the L1 resolution, is to apply this call on L1 using the data from the roll-up's outbox. This will forward the
information from the resolver to the inbox of roll-up A in the form of a call to the `resolution registry` on roll-up A.
This registry will store in its state a mapping from `fill hash` to `Bob`, allowing the `request manager`
to verify that a claim to fill a certain request with a certain fill ID is honest. Roll-up A's chain ID is necessray for the
`resolver` contract to know to which `resolution registry` to forward the proof to. Roll-up B's chain ID is used to
restrict the call to authenticated `fill manager` and `cross domain messenger` contracts.

After L1 resolution has transferred the fill information from roll-up B to roll-up A, Bob can directly call `withdraw` on
the `request manager` on roll-up A. That will compute a `fill hash` and query the `resolution registry` for the filler
address corresponding to `fill hash`, which will return Bob's address. Bob will be immediately considered the winner of
the challenge and receive its stake as well as Charles' stake, the tokens locked by Alice, and the fees paid by Alice for the service.

The reason we need to use `fill ID = Hash(fill block number)` in the proof is to allow Charles to make sure whether the
claim by Bob is rightful. Upon submitting the claim with a certain `fill ID`, Charles can look for the block with the associated number
and see whether a fill was correctly made by Bob. Without this ID, an evildoer could claim an unfilled request and only
fill it once its claim is challenged, to gain the stake of the challenger.

False claims challenges
+++++++++++++++++++++++

We saw that if Bob filled Alice's a claim, he will always be able to prove correctness of the fill in order to withdraw
its due from the `request manager` manager contract. However, if Charles falsely claims and withdraw rewards from the contract,
there will be no funds left for Bob. In order to prevent that, Bob also needs to challenge Charles' false claim.

As we saw in the previous part, Bob can use the `fill ID` provided by Charles during his claim to find out if the claim is
rightful or not. Upon seeing that it is not, Bob can challenge Charles' claim. The process will be the same as described
in the previous part about rightful claims resolutions, except that Charles will not be able to prove via L1 resolution
that his claim is rightful.

The first possible outcome is that the `challenge period` ends while Bob is ahead. In that case Bob will gain Charles'
stake and Charles will not be able to withdraw anything. In the event that Charles keep on contesting Bob's challenges
and reach a point where Bob no longer has enough funds to stake, Bob (or anyone else) will need to fill Alice's request
on roll-up A and trigger L1 resolution for that correct fill. This will prove that the request was filled by someone else
than Charles and declare Bob as a winner of the challenge. Bob will then be rewarded for its participation by gaining
Charles' stake.

Self challenges
+++++++++++++++

To make the protocol easier to reason about and implement, only two actors can participate in a challenge: the original
claimer, and the initial challenger. This raises the concern that, after doing its false claim, Charles could challenge
himself to prevent Bob from challenging him. This will let Bob control the state of his challenge and he will be able to
let it expire with his claim successful as an outcome.

To prevent this successful `self-challenged claim` to allow Charles to withdraw Alice's deposit, Bob can fill Alice's request
and do his own claim in parallel. If Bob's claim is not challenged and `claim period` is lower than the `challenge period`,
Bob will be able to withdraw Alice's deposit before Charles, leaving nothing for Charles to gain.

Charles can attempt to delay Bob's withdrawal by challenging its rightful claim. If Charles' stake on the rightful claim
is sufficient to cover Bob's fee for L1 resolution, Bob will proceed with L1 resolution. If not, Bob can continue opening
parallel claims until Charles no longer contest one of them, or there is enough cumulated stake form Charles on the
multiple challenges for Bob to do an L1 resolution. In any case, Bob will be able to prove its rightful claim before
Charles' claim reach the end of its period.

Claims that cannot be filled
++++++++++++++++++++++++++++

In either the regular `false claim` and `self-challenge claim` cases, we assumed that Bob could fill Alice's request in
order to prove that the false claimer Charles was not the correct filler. However, If Alice's request cannot be filled
for any reason (e.g. transfer value too high), instead of proving that someone other than Charles filled a request,
Bob will need to prove that no one filled the request before a certain block height. For that, Bob needs to create and
submit an `L1 non-fill proof` from roll-up A to roll-up B.

Exact specification TBD: https://github.com/beamer-bridge/beamer/issues/346

Fees
~~~~

Users will pay a fee for bridging their tokens. This fee needs to cover the expense of the liquidity provider and reward
them. The fees also include a protocol fee, rewarding builders of the protocol.

In theory, the fee should follow the formula:

::

    fee = tx fee fill + tx fee claim + tx fee withdraw funds / number of cumulative withdraws +
          opportunity cost(requested tokens, claim period) + opportunity cost(claim deposit, claim period) + margin

In practice, the transaction fees depend on the current gas price, which depends on the status of the network.
Additionally, the opportunity costs can only be estimated. To have a truly faithful fee for the service provider, the
user would have to register what fee they are willing to pay for their transfer upon requesting them. This would create
a fee market where different service provider would compete and accept different fees. Users would then need to query the
market for which fee they should use.

However, as the protocol intends to be as easy to use as possible for the user, and transactions fees are mostly stable
on roll-ups, the protocol implements a fixed fee for every transfer. This fixed fee uses a fixed estimation of the gas
price of the roll-up as well as a fixed margin for liquidity provider.


Agent strategy
--------------

We call `agent` the software run by liquidity providers to observe the roll-ups, fill users request, and participate in
challenges. The protocol defines some rules and demonstrate how honest participation is incentivized. However, the agent
could still implement different strategies to follow the protocol. For example, the agent is free to chose the value
with which it will bid in challenges. It is also allowed to decide when to stop out-bidding opponents in challenges and
going through L1 resolution or opening parallel claims.

The current implementation of the agent follows the strategy:

- Challenge a claim from wrong filler with `claim stake + 1`
- Challenge a claim with no filler with `cost of L1 non-fill proof`
- Subsequent counter challenge should cover the cost of L1 resolution
- Proceed with L1 resolution only when the stake of the opponent covers the cost and you are losing a challenge
- Open a parallel claim to one of your rightful claim if there is a challenged wrongful claim that expires before
  your challenged rightful claim and there is not enough stakes for L1 resolution.

Protocol parameters
-------------------

The choice of different protocol parameters such as `claim period` or `claim stake` is explained in the `Contract Parameters`
page.

One important decision is not to wait for the inclusion period of roll-ups to consider an event as successful. When
liquidity providers fill a user request, the event regarding the successful fill is sent by the target roll-up sequencer.
The liquidity provider directly sends a claim for this filled request on the source roll-up and does not wait for the block
produced by the sequencer to be committed to L1.

As far as we know, it is allowed for different roll-up sequencers to take as long as one week to commit their block to L1.
It could theoretically occur that after one week, the roll-up commits to a block that does not result in a successful fill
of the request by the liquidity provider. To take that into account, we would need to lengthen the `claim period` parameter by
one additional week, which would result in higher opportunity costs for the liquidity provider.

In practice the longest observed delay of block inclusion from a roll-up sequencer has been 18 hours, and was exceptional.
Hence the decision not to take into account this delay.
