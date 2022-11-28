
.. _contract_parameters:

Contract Parameters
===================


Summary
-------

.. code::

    claimStake = k * avg\_gp\_l2a * (gas_{challenge} + gas_{withdraw})
    claimRequestExtension = max(offline rollup) = 1 day
    claimPeriod = max(offline rollup) = 1 day
    challengePeriod = finalityPeriod[targetRollup] + buffer = 8 days
    challengePeriodExtension = 1 day
    minValidityPeriod = 30 minutes
    maxValidityPeriod = 48 hours

claimStake
----------

The parameter ``claimStake`` describes the amount of funds denominated in ETH that a claimer has to
stake upon each request. For each claim the claimer must send the claimStake. In case of
misbehavior, which is not having fulfilled the claim as stated, the claimer risks to lose his stake.
If following the protocol, an honest claimer will always be able to withdraw at least the stake
after the claim expired.

A lower boundary can be defined as the minimum value to cover the cost of challenging. Otherwise
there would be no financial incentive for challengers to secure the protocol.

Since every time the claimer is leading, new challengers can join the challenge, every outbid by
the claimer also needs to cover ``claimStake`` for a potential new agent to join. That is, the claimer needs to respond
to challenges with enough funds to cover the stake of the current challenger plus ``claimStake``.

The higher ``claimStake`` is chosen, the more capital an honest claimer must lock for the period
``claimPeriod``.  This can be reflected in opportunity costs for each LP. This being said, the
higher the chosen ``claimStake``, the higher the incentivization to challenge dishonest claims.
For a sustainable business model, each LP would reflect those costs in the fees he would accept.
The protocol costs for the end user would increase.

Proposed Values
^^^^^^^^^^^^^^^

.. math::

   claimStake = k * avg\_gp\_l2a * (gas_{challenge} + gas_{withdraw})

.. glossary::

    :math:`gas_{challenge}`
        gas cost of a challenge

    :math:`gas_{withdraw}`
        gas cost of a withdraw

    :math:`k`
       reward parameter to incentivize interacting with the protocol (challenge on false claims)

    :math:`avg\_gp\_l2a`
       average gas price over a period of time of source rollup where claim and challenge happens

We propose a value of ``k = 1.3`` so that honest challengers are rewarded with a minimum of 30% of the challenge gas
costs. The other parameters should be determined at time of deployment.

claimRequestExtension
---------------------

``claimRequestExtension`` defines the period after a request expiry in which an agent is still
allowed to make a claim for this request.

The minimum claim request extension must ensure that the honest agent is able to claim a request. After the time has
passed, no claiming is possible anymore. This is necessary so that an expired request can be withdrawn by the user
eventually. Practical influencing factors also include experienced downtimes of existing rollups. Experienced downtimes
were as high as 17 hours.


Proposed Values
^^^^^^^^^^^^^^^

``claimRequestExtension = 1 day``

claimPeriod
-----------

``claimPeriod`` defines the period after which a claim expires if not challenged.

The minimum claim period must ensure that at least one honest challenger is able to challenge a
false claim before it expires. Practical influencing factors also include experienced downtimes of
existing rollups. Experienced downtimes were as high as 17 hours.

A higher claim period increases the opportunity costs for honest claimers.


Proposed Values
^^^^^^^^^^^^^^^

``claimPeriod = 1 day``


challengePeriod
---------------

The ``challengePeriod`` describes the initial period of a challenge. This period has to be long enough to allow for the
L1 resolution proof to be transmitted from the target rollup to the source rollup. It takes at minimum
``finalityPeriod[targetRollup]`` for the proof to be available for transmission. For optimistic rollups this value is
typically defined as 7 days but this might change in the future and differ for each rollup implementation. That each
challenged claim can be L1 resolved is a hard requirement.

Additionally, the ``challengePeriod`` must include a time buffer after the finalization of the target rollup happened.
There must be enough time to actually execute L1 resolution before ``challengePeriod`` ends. The rationale for
choosing the exact value of the buffer can be derived from ``claimPeriod``.

.. math:: challengePeriod = finalityPeriod[targetRollup] + buffer

Proposed Values
^^^^^^^^^^^^^^^

.. code::

    finalityPeriod[targetRollup] = 7 days for most rollups
    buffer = 1 day
    challengePeriod = 8 days

challengePeriodExtension
------------------------

``challengePeriodExtension`` defines the value for which the challenge period should be extended after an event
(challenge or counter challenge) happened. Each opponent should always have the time to react in the challenge game,
thus there must be enough time left for him to do so. To decide on the value we can refer to the same rationale as for
``claimPeriod``. Note that the calculation for the new finalization of the current challenge is calculated as
``end time = max(current challenge end, time.now() + challengePeriodExtension)`` This is necessary to ensure that there
is at least ``challengePeriodExtension`` for the participant to react, but it might be possible that there is more time
left. This comes from the initial ``challengePeriod`` value which depends on the finality period of the target rollup.

Proposed Value
^^^^^^^^^^^^^^

.. code::

    challengePeriod = claimPeriod = 1 day

Expiration time
---------------

Each request will have an expiration time set after which, if not claimed, the user is able to
withdraw the funds back. This mechanism ensures that no funds will be locked forever if nobody wants
or is able to fill the request.

In order to prevent (accidental) misbehavior by the user, we can restrict expiration times by lower
and upper boundaries. Each LP has to decide within its own strategy how to react on certain
expiration times. While setting a very low expiration time most likely leads to not being fulfilled
by any LP, an upper boundary ensures that funds can eventually be withdrawn. With the current setup
of fixed fees and a race between LPs, we introduce a safety net for LPs to ensure that there is
enough time to register a claim of a filled request *before* it expires.
An LP is able to claim a request after its expiry date. The period in which an LP can do that is
defined by ``claimRequestExtension``. Note that during this time, the user can also withdraw the funds
if there are no active claims.

Proposed Values
^^^^^^^^^^^^^^^

.. code::

    minValidityPeriod = 30 minutes
    maxValidityPeriod = 48 hours
