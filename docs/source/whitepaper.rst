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
This is done by forwarding the loss of the attacker to the victim. We also economically incentivize honest participants
to enforce the security of the protocol.

The protocol
------------

The protocol is separated into two games with different levels of economic incentives. Those economic incentives
interfere only slightly with each other. This model is chosen to cover the problem of economic viability of fraud
proofs when it comes to very low amounts of earnings.

First concern: service provision
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

The process starts with the actual service provision to the user. The end user, further called Alice, will send a
request on the source rollup (A) by locking up the tokens in the ``RequestManager`` contract specifying how the
request can be filled.

The parameters that need to be specified by the users are:

- target chain ID
- source token address
- target token address
- recipient address on target rollup
- amount
- validity period of request

A liquidity provider, later called Bob, provides the service by directly filling the request on target rollup (B).
He now pays Alice upfront through a contract called ``FillManager`` and Alice receives the tokens without having to
send any subsequent transactions.

Alice will pay a fee for bridging her tokens. This fee needs to cover the expense of the liquidity provider and reward
them. The fee also includes the Beamer service fee, which is used for further development of the protocol.

Security for Alice
++++++++++++++++++

Alice's main concern is having her locked tokens taken away, while not receiving bridged tokens on rollup B. This is not
possible as long as there is one honest participant who is following the game theoretic model of the challenge protocol
explained in the next section.

In any case, once she received tokens on rollup B, Alice can ignore the rest of the protocol and enjoy her bridged tokens!

If her request cannot be fulfilled by liquidity providers (e.g. amount too high, rollups sequencers offline for some time, ...),
the ``validity period`` argument she specified will determine for how long the request will remain open on rollup A. After
this period, the request can no longer be filled and she can withdraw her locked tokens.

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
is properly filled. The hash of these parameters, as well as the rollup B's chain ID, constitutes the ``request hash``
that can later serve to prove that the request was properly filled.

::

    request hash = Hash(request ID, source chain ID, target chain ID,
                        target token address, recipient address, amount)

When filling the request, a ``fill ID`` is also computed, that serves to identify a fill. Detailed information on the
``fill ID`` can be found in section :ref:``fill_id``.

After filling the request, Bob will immediately claim the refund on rollup A. In doing so, he submits the ``request ID``,
and ``fill ID`` to rollup A. This initiates a ``claim period`` during which the validity of the fill by
Bob can be contested. Bob is required to send a deposit ``claim stake`` in rollup A's coin, that will be lost if
his claim is proven to be eventually incorrect.

If any participant contests Bob's claim, the protocol will immediately enter the challenge game. This
participative challenge protocol exists to optimistically determine the validity of the claim by the participants
outbidding each other with increasing stakes. Once the challenge period ends, the highest bidder will win the challenge
and thus the stakes. Additionally, the protocol evaluates the validity of the claim by the outcome of the challenge
winner. In other words, if the claimer wins the challenge, the claim is accepted to be valid and vice versa.

Since rollup A does not have direct access to the state of rollup B, we use this approach to assume the validity by
putting financial pressure on the dishonest participant. If the optimistic approach does not conclude,
a proof of the fill for the corresponding request can be passed from rollup B to rollup A via L1.

We use a cheap optimistic approach that does not require L1 to drastically reduce the costs of bridging the tokens for
Bob, and only use the more costly ``L1 resolution`` in case of an attack to ensure the security of the protocol. By
implementing L1 resolution we can guarantee Layer 1 security if at least one honest participant follows the protocol.
Additionally, as we will see later, the cost of the L1 resolution will be paid by the attacker.

Rightful claims resolutions
+++++++++++++++++++++++++++

In the game theoretic case, rightful claims will not be contested. After ``claim period``, Bob can withdraw his stake,
the tokens locked, and the LP fee paid by Alice.

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

The rightful claim of Bob can however be challenged by anyone during its ``claim period``. This will start a challenge between
him and the challenger, Charles. Charles needs to stake a deposit higher than ``claim stake`` to challenge Bob's claim.
The challenge will be on-going until the end of the ``challenge period``.

During the challenge, the contested participant (in turn Bob, then Charles), can submit a transaction to confirm its
position and contest the other party. It is required that the new stake of the participant is higher than the current
stake of the opponent. Everytime a participant responds to the challenge, the termination time of the challenge and
underlying claim is extended to be at least ``challenge period extension``, to give time for the other party to respond.

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
Bob can trigger the ``L1 resolution``.

L1 resolutions
++++++++++++++

When Bob filled Alice's request, a proof was sent by the ``fill manager`` contract on rollup B to the outbox of
rollup B on L1. This proof is a call to a ``resolver`` contract on L1 and contains the following fields:

- fill hash = Hash(request hash, fill ID)
- rollup B's chain ID
- rollup A's chain ID
- Bob's address

To trigger L1 resolution is to apply this call on L1 using the data from the rollup B's outbox. This will forward the
information from the resolver to the inbox of rollup A in the form of a call to the ``resolution registry``.
This registry will store in its state a mapping from ``fill hash`` to ``Bob``, allowing the ``request manager``
to verify that a claim to fill a certain request with a certain fill ID is honest. Rollup A's chain ID is necessary for
the ``resolver`` contract to know to which ``resolution registry`` to forward the proof to. Rollup B's chain ID is used to
restrict the call to authenticated ``fill manager`` and ``cross domain messenger`` contracts.

After L1 resolution has transferred the fill information from rollup B to rollup A, Bob can directly call ``withdraw`` on
the ``request manager`` on rollup A. This will compute a ``fill hash`` and query the ``resolution registry`` for the filler
address corresponding to ``fill hash``, which will return Bob's address. Bob will immediately be considered the winner of
the challenge and receive his stake as well as Charles' stake, the tokens locked by Alice, and the fees paid by Alice for the service.

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

.. _fill_id:

Why do we need the fill ID?
+++++++++++++++++++++++++++

The reason a claimer needs to submit a ``fill ID`` is to make a statement as to when the related request was filled. It is
returned by the ``FillManager`` contract on rollup B and there will always be only one valid ``fill ID`` to a fill of a
requests. Enforcing a submission of an ID, certain attacks on honest challengers are prevented. Without this ID, an
evildoer could claim an unfilled request and only fill it once its claim is challenged thus turning it into a rightful
claim and gaining the challenger's stake. The ``fill ID`` is defined as:

::

    fill_id = hash(previous block)

When seeing a claim with a certain ``fill ID``, observers can verify if a fill with corresponding ID has been made. If they
know of no fill with this fill ID, they are guaranteed the claim is wrongful, as long as the claimer did not guess the hash
of a block in the future correctly.

Any claim with a different ``fill ID`` than the generated value upon filling the request is considered to be a false claim.

Challenging false claims
++++++++++++++++++++++++

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
on rollup A and trigger L1 resolution for it. This will prove that the request was filled by someone other
than Charles and declare Bob as a winner of the challenge. Bob will then be rewarded for his participation by gaining
Charles' stake.

Note that we have a time constraint until when it is safe for Bob to fill the request. This is based on the assumption
that Charles is able to win the challenge by bidding an amount high enough which Bob is not capable of outbidding
anymore. While this is the very use case for L1 resolution, Bob must make sure that his fill proof arrives at the
source rollup before Charles wins the false claim and thus becomes able to withdraw the deposit.
To find a value until when it is safe for Bob to fill the request, we consider the end of ``challengePeriod`` of Charles'
false claim called ``false claim termination``. Transferring Bob's fill proof to the rollup A will take at least
``finalization time[rollup B]``. We derive the following condition:

::

    timestamp Bob's fill < false claim termination - finalization time[rollup B]

In any case, this condition will always be fulfilled if Bob fills the request before he challenges Charles' false claim.

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

In the previous explanation, we only talked about two participants to the challenges, Bob and Charles. What if, after
submitting his false claim, Charles challenges himself. This would let Charles control the state of his challenge and
he would be able to let it expire with his claim successful as an outcome.

To prevent this successful ``self-challenged claim`` to allow Charles to withdraw Alice's deposit, Bob can fill Alice's request
and do his own claim in parallel. If Bob's claim is not challenged and ``claim period`` is lower than the ``challenge period``,
Bob will be able to withdraw Alice's deposit before Charles, leaving nothing for Charles to gain.

Charles can attempt to delay Bob's withdrawal by challenging Bob's rightful claim. If Charles' stake on the rightful claim
is sufficient to cover Bob's fee for L1 resolution, Bob will proceed with L1 resolution. If not, Bob can continue opening
parallel claims until Charles no longer contests one of them, or there is enough accumulated stake from Charles on the
multiple challenges for Bob to do an L1 resolution. In any case, Bob will be able to prove his rightful claim before
Charles' claim reach the end of its period. The time constraint described in the previous example also holds in this case.

Claims that cannot be filled
++++++++++++++++++++++++++++

In both the regular ``false claim`` and ``self-challenge claim`` cases, we assumed that Bob could fill Alice's request in
order to prove that the false claimer Charles was not the correct filler. However, If Alice's request cannot be filled
for any reason (e.g. transfer value too high), instead of proving that someone other than Charles filled a request,
Bob will need to prove that Charles did not fill the request as claimed. For that, Bob needs to create and submit an
``L1 non-fill proof`` from rollup B to rollup A.

When called, the fill manager contract on rollup B recomputes the fill hash from the request hash, and fill ID,
and checks that no fills exists for the corresponding request hash and fill hash. It then submits a proof
to the outbox of rollup B indicating that the fill hash is invalid, i.e. that the request hash cannot be mapped to the
fill hash.

Similarly to the filled L1 resolution case, Bob can then trigger a call on L1 to forward this message to rollup A. This
message will store in the ``resolution registry`` that the ``fill hash`` is invalid and make any claim from Charles with
the corresponding hash an invalid claim.

To make sure the proof arrives in time on rollup A, Bob will need to call the ``fill manager`` as soon as he notices a
false claim for a non-filled request. It takes ``finalization time of rollup B`` after Bob's call to be able to send the
proof, while the challenge period is defined to be ``finalization time of rollup B + challenge period extension``.

In the case where someone challenges Charles on the false claim at the same time as Bob sends the transaction for the
proof on rollup B, Bob will not be able to challenge Charles and will not receive any financial reward from having sent
this transaction. The situation being unlikely to happen and the costs of rollup transactions being low, we believe this
not to be too big of a problem.

The costly L1 transaction can however be sent only when Bob is properly incentivized, that is he is at stake in the
challenge against Charles.

Non-fill proofs and self challenges
+++++++++++++++++++++++++++++++++++

We explained in a previous part a strategy for honest fillers to counter wrongful self-challenged claims. To be properly
incentivized for the submission of the non-fill proof on L1, we need to allow Bob to join a self-challenged claim
initiated by Charles as an additional challenger.

There is no need for Bob to enter the challenge if the claimer is in a losing position, we only allow new challengers if
the claimer is ahead in the challenge. This is done by a bookkeeping mechanism of bidders and bids. We store in a mapping
who bid which amount in total and who was the last bidder.

The rationale behind the book keeping is that anybody who entered into a challenge and put in some stake should be
rewarded when his position wins, depending on the amount they had to put in. When the challenge ends, if the claimer is
ahead, he will earn the stakes of every challenger. If a challenger is ahead, each non-last challenger earns a value
equal to their total stake. The stake of the last challenger being only partially covered by the claimer, he will only
earn ``stake claimer - stake other challengers``, i.e. the remaining tokens.

In the case where the dishonest party was leading and the L1 resolution proved him to be incorrect, there will be an
excess of stake that can be redistributed to the last bidder, or, if known, to the one responsible for the L1 transaction.

This allows honest watchers to enter into any challenge at any point in time, provoking the dishonest counterpart to
either bid more (and thus lose more) or to end the challenge game. The potential minimum gain for each bid is
``stake winning party - stake losing party``, if not overbid.

For example, if Charles makes a claim with a stake of 5, and David challenges with a stake of 6, the bookkeeping will
look like so:

=========  =======
 Charles    David
=========  =======
    5         6
=========  =======

After Charles overbids by 5, his total stake is now 10, and Bob needs to bid more than 4 to join the challenge. After
Bob bids 5, the stakes look like so:

=========  =======  ======
 Charles    David    Bob
=========  =======  ======
    10        6       5
=========  =======  ======

If the challenge end at this point, David would earn 6 coins from Charles' stake, and Bob only 4. However, if Charles is
proven via L1 resolutions to be the correct filler, he will earn 11 coins from the cumulated stakes of David and Bob.

Fees
~~~~

Users will pay a fee for bridging their tokens. This fee needs to cover the expense of the liquidity provider and reward
them. The fees also include a Beamer service fee, which is used for further development of the protocol.

In theory, the fee should follow the formula:

::

    fee = tx fee fill +
          tx fee claim +
          tx fee withdraw funds / number of cumulative withdraws +
          opportunity cost(requested tokens, claim period) +
          opportunity cost(claim stake, claim period) +
          margin

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

``Agents`` is the term we use for the software run by liquidity providers to observe the rollups, fill users' requests,
and participate in challenges. The protocol defines some rules and demonstrates how honest participation is incentivized.
However, the agent could still implement different strategies to follow the protocol. For example, the agent is free to
choose the value with which it will bid in challenges. It is also allowed to decide when to stop out-bidding opponents
in challenges and go through L1 resolution or open parallel claims.

The current implementation of the agent follows this strategy:

* Challenge a false claim with ``claim stake + 1``
* Challenge a claim with no filler with ``cost of L1 non-fill proof``
* Join a challenged non-filled claim with ``cost of L1 non-fill proof``
* Subsequent counter challenge should cover the cost of L1 resolution
* Immediately send ``non-fill proof call`` on target rollup for claims with no corresponding fills
* Proceed with L1 resolution only when the stake of the opponent covers the cost and we are losing a challenge
* Open a parallel claim to one of our rightful claims if:
    * there is a challenged wrongful claim C for the same request and
    * C expires before our challenged rightful claim and
    * the stake amount is not high enough for L1 resolution.

Protocol parameters
-------------------

The choice of different protocol parameters such as ``claim period`` or ``claim stake`` is explained in :ref:``contract_parameters``.

One important decision regarding parameters is not to wait for the inclusion period of rollups to consider an event as successful.
When liquidity providers fill a user request, the event regarding the successful fill is sent by the target rollup sequencer.
The liquidity provider directly sends a claim for this filled request on the source rollup and does not wait for the block
produced by the sequencer to be committed to L1.

As far as we know, it is allowed for different rollup sequencers to take as long as one week to commit their block to L1.
It could theoretically occur that after one week, the rollup commits to a block that does not result in a successful fill
of the request by the liquidity provider. To take that into account, we would need to lengthen the ``claim period`` parameter by
one additional week, which would result in higher opportunity costs for the liquidity provider.

In practice the longest observed delay of block inclusion from a rollup sequencer has been 18 hours, and was exceptional.
Hence the decision not to take this delay into account.
