.. _protocol:

===================
The Beamer Protocol
===================

Introduction
============

Beamer is a protocol to enable users to move tokens from one chain to another. The user requests a transfer by
providing tokens on the source chain. Liquidity providers then fill the request and directly send tokens to the user
on the target chain.

The core focus of the protocol is to be as easy to use as possible for the end user. This is achieved through
separating two different concerns: the service provision to the end user, and the reclaiming of funds by the
liquidity provider. The service is provided optimistically as soon as the request arrives. Being refunded on the
source chain is secured by its own mechanism and decoupled from the actual service.

Ultimately and only if necessary, any dispute can be resolved with the help of L1 providing the state from the target
chain to the source chain. As all chains store their data on the same base chain, eventually state will be able to be
transmitted to each other.

Principles
==========
UX
--

Other competitors seem to have prioritized easy implementations over user experience. For example, most bridges make
it necessary for the end user to do two transactions on two different chains. This costs time and requires
onboarding in advance. **We want to focus on the best possible UX**. This applies to all users in the system.

- Fast execution for the end user
- One transaction (send and receive directly)
- Fees are paid in the token being moved to the target chain

The service provider (market maker, liquidity provider) needs to have predictability over the costs and gains.
Additionally, there has to be a guarantee of a refund for the service provided.

Optimistic protocol
-------------------

In order to guarantee the above, the protocol is designed in an optimistic manner. The protocol is streamlined for
the optimal case where no evildoers attempt to attack it. We then make sure that anyone attacking the system will be
punished financially. The protocol also tries to make up for additional opportunity costs suffered by the victims.
This is done by forwarding the loss of the attacker to the victim. We also economically incentivize honest participants
to enforce the security of the protocol.

The protocol
============

The protocol is separated into two games with different levels of economic incentives. Those economic incentives
interfere only slightly with each other. This model is chosen to cover the problem of economic viability of fraud
proofs when it comes to very low amounts of earnings.

First concern: service provision
--------------------------------

The process starts with the actual service provision to the user. The end user, further called Alice, will send a
request on the source chain (A) by locking up the tokens in the ``RequestManager`` contract specifying how the
request can be filled.

The parameters that need to be specified by the users are:

- target chain ID
- source token address
- target token address
- recipient address on target chain
- amount
- validity period of request

A liquidity provider, later called Bob, provides the service by directly filling the request on target chain (B).
He now pays Alice upfront through a contract called ``FillManager`` and Alice receives the tokens without having to
send any subsequent transactions.

Security for Alice
~~~~~~~~~~~~~~~~~~

Alice's main concern is having her locked tokens taken away, while not receiving bridged tokens on chain B. This is not
possible as long as there is one honest participant who is following the game theoretic model of the challenge protocol
explained in the next section.

In any case, once she received tokens on chain B, Alice can ignore the rest of the protocol and enjoy her bridged tokens!

If her request cannot be fulfilled by liquidity providers (e.g. amount too high, chains sequencers offline for some time, ...),
the ``validity period`` argument she specified will determine for how long the request will remain open on chain A. After
this period, the request can no longer be filled and she can withdraw her locked tokens.

Second concern: claim and challenge
-----------------------------------

Bob will only fill a request if he is guaranteed by the protocol to receive the tokens locked by Alice on chain A,
this is our second concern. When filling the request, Bob submits the following parameters:

- source chain ID
- target token address
- recipient address
- amount
- nonce

These parameters are useful to let other liquidity providers (or any observer) know that a request they saw on chain A
is properly filled. The hash of these parameters, as well as the chain B's chain ID, constitutes the ``request ID``
that can later serve to prove that the request was properly filled.

::

    request ID = Hash(source chain ID, target chain ID,
                        target token address, recipient address, amount, nonce)

When filling the request, a ``fill ID`` is also computed, that serves to identify a fill. Detailed information on the
``fill ID`` can be found in section :ref:`fill_id`.

After filling the request, Bob will immediately claim the refund on chain A. In doing so, he submits the ``request ID``,
and ``fill ID`` to chain A. This initiates a ``claim period`` during which the validity of the fill by
Bob can be contested. Bob is required to send a deposit ``claim stake`` in chain A's coin, that will be lost if
his claim is proven to be eventually incorrect.

If any participant contests Bob's claim, the protocol will immediately enter the challenge game. This
participative challenge protocol exists to optimistically determine the validity of the claim by the participants
outbidding each other with increasing stakes. Once the challenge period ends, the highest bidder will win the challenge
and thus the stakes. Additionally, the protocol evaluates the validity of the claim by the outcome of the challenge
winner. In other words, if the claimer wins the challenge, the claim is accepted to be valid and vice versa.

Since chain A does not have direct access to the state of chain B, we use this approach to assume the validity by
putting financial pressure on the dishonest participant. If the optimistic approach does not conclude,
a proof of the fill for the corresponding request can be passed from chain B to chain A via L1.

We use a cheap optimistic approach that does not require L1 to drastically reduce the costs of bridging the tokens for
Bob, and only use the more costly ``L1 resolution`` in case of an attack to ensure the security of the protocol. By
implementing L1 resolution we can guarantee Layer 1 security if at least one honest participant follows the protocol.
Additionally, as we will see later, the cost of the L1 resolution will be paid by the attacker.

Rightful claims resolutions
~~~~~~~~~~~~~~~~~~~~~~~~~~~

In the game theoretic case, rightful claims will not be contested. After ``claim period``, Bob can withdraw his stake,
the tokens locked, and the LP fee paid by Alice.

.. mermaid::
    :caption: `Unchallenged Claim`

    sequenceDiagram

    participant Alice
    participant Bob
    participant Chain A
    participant Chain B

    Alice->>Chain A: requests transfer
    Bob->>Chain A: watches for requests
    Bob->>Chain B: fills request
    Chain B->>Chain B: Alice receives tokens
    Bob->>Chain A: claims tokens
    note over Chain A: wait for `claim period`
    Bob->>Chain A: withdraws tokens

The rightful claim of Bob can however be challenged by anyone during its ``claim period``. This will start a challenge between
him and the challenger, Charles. Charles needs to stake a deposit higher than ``claim stake`` to challenge Bob's claim.
The challenge will be ongoing until the end of the ``challenge period``.

During the challenge, the contested participant (in turn the claimer and the challenger), can submit a transaction to confirm its
position and contest the other party. It is required that the new stake of the participant is higher than the current
stake of the opponent. Every time a participant responds to the challenge, the termination time of the challenge and
underlying claim is extended to be at least ``challenge period extension``, to give time for the other party to respond.

At the end of the challenge period, the last non-contested participant, and thus the participant with the highest stake, wins. The claim
will be seen as valid if the winner of the challenge game is the original claimer. This means that he will be able to
withdraw Alice's deposit. In any case, the winning participant will be rewarded with the deposit of the losing side.

.. mermaid::
    :caption: `Challenged Claim`

    sequenceDiagram

    participant Bob
    participant Charles
    participant Chain A
    participant Chain B

    Bob->>Chain B: fills request
    Bob->>Chain A: claims tokens

    loop
    Charles->>Chain A: challenges Bob's claim
    Bob->>Chain A: counter-challenges
    end

    note over Charles, Chain A: wait for end of challenge
    Bob->>Chain A: withdraws tokens

The protocol also allows additional participants to join the challenge and contest the claim in place of Charles. This can be
done only when the claimer is ahead in the challenge and it is the challenger's turn to participate. The reason behind
it is to prevent a single actor from playing both sides of the challenge and controlling the result.

To properly reward the winners of the challenge, we need a bookkeeping mechanism of bidders and bids. We store in a mapping
who bid which amount in total and who was the last bidder. When the challenge ends, if the claimer is
ahead, he will earn the stakes of every challenger. If a challenger is ahead, each non-last challenger earns a value
equal to their total stake. The stake of the last challenger being only partially covered by the claimer, he will only
earn ``stake claimer - stake other challengers``, i.e. the remaining tokens.

In the case where the dishonest party was leading and the L1 resolution proved him to be incorrect, there will be an
excess of stake that can be redistributed to the last bidder, or, if known, to the one responsible for the L1 resolution.

This allows honest watchers to enter into any challenge at any point in time, provoking the dishonest counterpart to
either bid more (and thus lose more) or to end the challenge game. The potential minimum gain for each bid is
``stake winning party - stake losing party``, if not overbid.

For example, if Bob makes a claim with a stake of 5, and Charles challenges with a stake of 6, the bookkeeping will
look like so:

======  =========
 Bob     Charles
======  =========
  5         6
======  =========

After Bob overbids by 5, his total stake is now 10, and challengers need to bid more than 4 to join the challenge. After
David bids 5, the stakes look like so:

======  ========= =======
 Bob     Charles   David
======  ========= =======
  10        6        5
======  ========= =======

If the challenge ends at this point, Charles would earn 6 coins from Bob's stake, and David only 4. However, if Bob is
proven via L1 resolutions to be the correct filler, he will earn 11 coins from the cumulated stakes of Charles and David.

To avoid this challenge to go on forever, or reach a point where Bob no longer has the funds to out-stake challengers,
Bob can trigger the ``L1 resolution``.

L1 resolutions
~~~~~~~~~~~~~~

When Bob filled Alice's request, a proof was sent by the ``fill manager`` contract on chain B to the outbox of
chain B on L1. This proof is a call to a ``resolver`` contract on L1 and contains the following fields:

- request ID
- fill ID
- chain B's chain ID
- chain A's chain ID
- Bob's address

To trigger L1 resolution is to apply this call on L1 using the data from the chain B's outbox. This will forward the
information from the resolver to the inbox of chain A in the form of a call to the ``request manager``.
This request manager will store ``Bob`` as the rightful filler and the ``fill ID`` to the request object. This marks any
claim created by Bob with the corresponding ``fill ID`` to be valid. The  Chain A's chain ID is necessary for
the ``Resolver`` contract to know to which ``request manager`` to forward the proof to. Chain B's chain ID is used to
restrict the call to the authenticated messenger contract on chain B.

After L1 resolution has transferred the fill information from chain B to chain A, Bob can directly call ``withdraw`` on
the ``request manager`` on chain A. Bob's address is stored in the request object, thus he will immediately be considered
the winner of the challenge and receive the challengers' stake, the tokens locked by Alice, and the fees paid by Alice for
the service. Note that after a request is resolved through L1, any claim about this request cannot be challenged anymore.
This is due to the fact, that any claim will be resolved correctly by the L1 resolution information.

.. mermaid::
    :caption: `L1 Resolution`

    sequenceDiagram

    participant Bob
    participant Charles
    participant Chain A
    participant Chain B
    participant L1

    Bob ->> Chain B: fills request
    Chain B ->> L1: registers fill proof
    Bob ->>Chain A: claims tokens

    loop until stakes high enough for L1 resolution
    Charles ->> Chain A: challenges Bob's claim
    Bob ->> Chain A: counter-challenges
    end
    Charles ->> Chain A: challenges Bob's claim
    note over Chain A: Charles will win if we \nwait for end of challenge

    Bob ->> L1: triggers L1 resolution
    L1 ->>Chain A: sends fill proof
    Bob ->>Chain A: withdraws tokens

.. _fill_id:

Why do we need the fill ID?
~~~~~~~~~~~~~~~~~~~~~~~~~~~

The reason a claimer needs to submit a ``fill ID`` is to make a statement as to when the related request was filled. It is
returned by the ``FillManager`` contract on chain B and there will always be only one valid ``fill ID`` to a fill of a
requests. By enforcing a submission of an ID, certain attacks on honest challengers are prevented. Without this ID, an
evildoer could claim an unfilled request and only fill it once its claim is challenged thus turning it into a rightful
claim and gaining the challenger's stake. The ``fill ID`` is defined as:

::

    fill ID = hash(previous block)

When seeing a claim with a certain ``fill ID``, observers can verify if a fill with corresponding ID has been made. If they
know of no fill with this fill ID, they are guaranteed the claim is wrongful, as long as the claimer did not guess the hash
of a block in the future correctly.

Any claim with a different ``fill ID`` than the generated value upon filling the request is considered to be a false claim.

Challenging false claims
~~~~~~~~~~~~~~~~~~~~~~~~

We saw that if Bob filled Alice's claim, he will always be able to prove correctness of the fill in order to withdraw
its due from the ``request manager`` contract. However, if Charles falsely claims and withdraws rewards from the contract,
there will be no funds left for Bob. In order to prevent that, Bob also needs to challenge Charles' false claims.

As we saw in the previous part, Bob can use the ``fill ID`` provided by Charles during his claim to find out if the claim is
rightful or not. Upon seeing that it is not, Bob can challenge Charles' claim. The process will be the same as described
in the previous part about rightful claims resolutions, except that Charles will not be able to prove via L1 resolution
that his claim is rightful.

The first possible outcome is that the ``challenge period`` ends while Bob is ahead. In that case Bob will gain Charles'
stake and Charles will not be able to withdraw anything. In the event that Charles keeps on contesting Bob's challenges
and reaches a point where Bob no longer has enough funds to stake, Bob (or anyone else) will need to fill Alice's request
on chain A and trigger L1 resolution for it. This will prove that the request was filled by someone other
than Charles and declare Bob as a winner of the challenge. Bob will then be rewarded for his participation by gaining
Charles' stake.

Note that we have a time constraint until when it is safe for Bob to fill the request. This is based on the assumption
that Charles is able to win the challenge by bidding an amount high enough which Bob is not capable of outbidding
anymore. While this is the very use case for L1 resolution, Bob must make sure that his fill proof arrives at the
source chain before Charles wins the false claim and thus becomes able to withdraw the deposit.
To find a value until when it is safe for Bob to fill the request, we consider the end of ``challengePeriod`` of Charles'
false claim called ``false claim termination``. Transferring Bob's fill proof to the chain A will take at least
``finality period[chain B]``. We derive the following condition:

::

    timestamp Bob's fill < false claim termination - finality period[chain B]

In any case, this condition will always be fulfilled if Bob fills the request before he challenges Charles' false claim.

.. mermaid::
    :caption: `False Claims Challenge`

    sequenceDiagram

    participant Bob
    participant Charles
    participant Chain A
    participant Chain B
    participant L1

    Charles ->>Chain A: claims tokens

    loop until stakes high enough for L1 resolution
    Bob ->> Chain A: challenges Charles's claim
    Charles ->> Chain A: counter-challenges
    end
    note over Chain A: Charles will win if we \nwait for end of challenge

    Bob ->> Chain B: fills request
    Chain B ->> L1: registers fill proof
    Bob ->> L1: triggers L1 resolution
    L1 ->> Chain A: sends fill proof
    Bob ->> Chain A: withdraws tokens

Claims that cannot be filled
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

In the previous part, we assumed that Bob could fill Alice's request in order to prove that the false claimer Charles
was not the correct filler. However, Alice's request might not be able to be filled (e.g. transfer value too high).
Instead of proving that someone other than Charles filled a request, Bob will need to prove that Charles did not fill
the request as claimed. For that, Bob needs to create and submit an ``L1 non-fill proof`` from chain B to chain A.

When called, the fill manager contract on chain B checks that no fills exists for the corresponding request ID and fill ID.
It then submits a proof to the outbox of chain B indicating that the fill ID is invalid for the given request ID, i.e.
that the request ID cannot be mapped to the fill ID. In order to prevent a specific race condition where a non-fill proof
is generated in the same block as the fill transactions, the current block's fill ID cannot be invalidated. 

Similarly to the filled L1 resolution case, Bob can then trigger a call on L1 to forward this message to chain A. This
message will store a flag in the request manager stating that the fill ID is invalid for the given request. This
invalidates any claim with the corresponding fill ID. The associated claims cannot be challenged anymore as they will be
resolved correctly by the invalidation data.

To make sure the proof arrives in time on chain A, Bob will need to call the fill manager as soon as he notices a
false claim for a non-filled request. It takes ``finality period of chain B`` after Bob's call is able to be executed
which then sends the proof to the request manager.  The challenge period is defined to be
``finality period of chain B + challenge period extension``.

In the case where someone challenges Charles on the false claim at the same time as Bob sends the transaction for the
proof on chain B, Bob may not be able to challenge Charles. If so, Bob may not receive financial reward from having sent
this transaction. The situation being unlikely to happen and the costs of chain transactions being low, we believe this
not to be too big of a problem.

Bob can however wait to be properly incentivized before sending the costly L1 transaction, that is he can wait to be at
stake in the challenge against Charles.

Fees
----

There are two fees that users need to pay to bridge their tokens:

Liquidity provider fee
~~~~~~~~~~~~~~~~~~~~~~

This fee is paid in token being moved, rewarding the LP for providing the bridging service.
The fee is variable, collected by the agent and defined in the request manager contract under ``lpFeePPM``
(percentage in parts per million). The ``lpFeePPM`` will be applied on the token amount transferred in order
to determine the absolute LP fee.

In theory, the agent fee should cover the gas costs, the opportunity costs of
the funds being locked plus all additional costs for running an agent and include a reward for providing the service.
However, for small transfer amounts the LP fee might not be enough to cover all of the above.
Therefore, a minimum LP fee is defined.

The final LP fee is defined as:

    .. math::
        max(minLpFee, (1+\frac{lpFeePPM}{1000000}) * amount)

Minimum LP fee
~~~~~~~~~~~~~~
The minimum LP fee is derived from the total transfer costs paid by the agent and the conversion rate from ETH to the
token. Additionally, a margin is applied to reward the LP for providing the service. Since the agent partially sends
transactions on the source (claimRequest and withdraw) and on the target chain (fillRequest) respectively, the fee needs
to be composed from two different base values. The reason for this is that transactions might have different costs on
two given chains.

The exact formula how the minimum LP fee is calculated is:

    .. math::
        ((1 - \tau(source)) * cost_{source, ETH}(\Delta t) + \tau(target) *cost_{target, ETH}(\Delta t)) *
        Price_{\frac{Token}{ETH}}(\Delta t) * margin_{LP}

The variables of the above formula are stored in the request manager contract:

For each chain:

- :math:`\tau(chain)` as ``Chain.targetChainPPM`` (the ETH cost for a fill on :math:`chain`, divided by 
    :math:`cost_{chain,ETH}`)
- :math:`cost_{chain,ETH}`  as ``Chain.transferCost`` (the sum of ETH costs for fill, claim and withdraw on that chain)

For each token:

- :math:`Price_\frac{token}{ETH}` as ``Token.ethInToken`` (the token -> ETH price conversion factor)

Global parameter:

- :math:`margin_{LP}` as ``minLpFeePPM``

Protocol fee
~~~~~~~~~~~~

The fee paid in token being moved, intended to support further development
of the Beamer protocol. The fee is variable, collected by the contract owner and defined in the request manager contract
under ``protocolFeePPM`` (percentage in parts per million). The ``protocolFeePPM`` will be applied on the token amount
transferred in order to determine the absolute protocol fee.


It is important to note that the opportunity costs can only be estimated. To have a truly faithful fee for the
liquidity provider, the user would have to register the maximum fee they are willing to pay for their transfer. This
would create a fee market where different liquidity providers would compete and accept different fees. Users would then
need to query the market for which fee they should use.

However, as the protocol intends to be as easy to use as possible, and
transactions fees are mostly stable on chains, the gas reimbursement fee is
included in the agent fee as the minimum value, below which no agent fee can
be set.


Agent strategy
--------------

``Agents`` is the term we use for the software run by liquidity providers to observe the chains, fill users' requests,
and participate in challenges. The protocol defines some rules and demonstrates how honest participation is incentivized.
However, the agent could still implement different strategies to follow the protocol. For example, the agent is free to
choose the value with which it will bid in challenges. It is also allowed to decide when to stop out-bidding opponents
in challenges and go through L1 resolution or open parallel claims.

The current implementation of the agent follows this strategy:

* Challenge a false claim with ``cost of L1 non-fill proof``
* Challenge a claim with no filler with ``cost of L1 non-fill proof``
* Join a challenged non-filled claim with ``cost of L1 non-fill proof``
* Subsequent counter challenge should cover the cost of L1 resolution
* Immediately send ``non-fill proof call`` on target chain for claims with no corresponding fills
* Proceed with L1 resolution only when the stake of the opponent covers the cost and we are losing a challenge

Protocol parameters
-------------------

The choice of different protocol parameters such as ``claim period`` or ``claim stake`` is explained in :ref:`reference-contract-parameters`.

One important decision regarding parameters is not to wait for the inclusion period of chains to consider an event as successful.
When liquidity providers fill a user request, the event regarding the successful fill is sent by the target chain sequencer.
The liquidity provider directly sends a claim for this filled request on the source chain and does not wait for the block
produced by the sequencer to be committed to L1.

As far as we know, it is allowed for different chain sequencers to take as long as one week to commit their block to L1.
It could theoretically occur that after one week, the chain commits to a block that does not result in a successful fill
of the request by the liquidity provider. To take that into account, we would need to lengthen the ``claim period`` parameter by
one additional week, which would result in higher opportunity costs for the liquidity provider.

In practice the longest observed delay of block inclusion from a chain sequencer has been 18 hours, and was exceptional.
Hence the decision not to take this delay into account.

Potential attacks
-----------------

Exhausting the agents funds
~~~~~~~~~~~~~~~~~~~~~~~~~~~

A dishonest agent may submit a false claim (i.e. attempts to claim a request which the agent did not fulfill). In
response, an honest agent (most likely the agent who did fulfill the request) will likely challenge the false claim with
an initial stake of ``claimStake + 1``, the minimum possible stake required to challenge. The dishonest agent may respond
with a counter-challenge of ``2 * claimStake + 1`` in total. If the dishonest agent counter-challenges, the honest agent
will likely escalate the challenge so the stake total is high enough to cover the cost of the L1 non-fill proof in the
event the dishonest agent counter-challenges again. If the honest agent does escalate the challenge, then the dishonest
agent may stop participating in the escalation game (i.e. decline to counter-challenge again). As a result, the honest
agent will have locked a higher stake than the dishonest agent. The honest agent will be temporarily unable to utilize
the stake amount for other purposes, including claiming/challenging other transfers and providing liquidity.

The dishonest agent can open parallel claims in an attempt to exhaust the funds of the honest agents. Once the honest
agents have no funds, the dishonest participant is the sole participant of the protocol and can do as he pleases.

For each opened claim, the attacker stakes ``claimStake + cost of L1 proof`` less than the honest
agent. The advantage factor of the attacker is ``(claimStake + cost of L1 proof) / (2 * claimStake + 1)``.
The attack is successful if

::

  total funds of attacker * advantage factor > total funds of honest agents.

The attacker will lose all it staked during the attack if liquidity providers discover the attack within the
``challenge period`` and are able to refund their agents or manually trigger the L1 non-fill proof. However, for
as long as it is the only participant, it will be able to wrongful claim any request and collect their rewards.

A strategy could be put in place by the challenger to only ever outbid the claimer by 1. This would prevent such attack
but it would take many more transactions to gather the funds for the L1 proof.

Since the protocol is open and any participant can join with its funds, we believe for this attack to be unpractical and
do not feel the need to mitigate it further.
