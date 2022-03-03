Contract Parameters
===================


Summary
-------

.. code::

    claimStake =
    claimPeriod = 1 day
    challengePeriod = finalizationTime[l2b] + 1 day
    challengePeriodExtension = 1 day
    minValidityPeriod = 5 minutes
    maxValidityPeriod = 52 weeks


claimStake
----------

The parameter ``claimStake`` describes the amount of funds denominated in ETH that a claimer has to
stake upon each request. For each claim the claimer must send the claimStake. In case of
misbehavior, which is not having fulfilled the claim as stated, the claimer risks to lose his stake.
If following the protocol, an honest claimer will always be able to withdraw at least the stake
after the claim expired.

Rationale
^^^^^^^^^

.. math::

   X = k * avg\_gp\_l2a * (max(gas_{challenge}, gas_{claim}) + gas_{withdraw})

.. glossary::

    :math:`X`
       initial claim stake.

    :math:`gas_{challenge}`
        gas cost of a challenge

    :math:`gas_{claim}`
        gas cost of a claim

    :math:`gas_{withdraw}`
        gas cost of a withdraw

    :math:`k`
       reward parameter to incentivize interacting with the protocol (challenge on false claims)

    :math:`avg\_gp\_l2a`
       average gas price over a period of time of source rollup where claim and challenge happens

A lower boundary can be defined as the minimum value to cover the cost of challenging. Otherwise
there would be no financial incentive to secure the protocol. This would happen with :math:`k <= 1`.

The higher :math:`k` is chosen, the more capital an honest claimer must lock for the period
``claimPeriod``.  This can be reflected in opportunity costs for each LP. This being said, the
higher the chosen :math:`k`, the higher the opportunity cost for the LP. For a sustainable business
model, each LP would reflect those costs in the fees he charges. The protocol costs for the end user
would increase.

Proposed Values
^^^^^^^^^^^^^^^

Current proposed values are

:math:`k = 1.3` -> A minimum of 30% reward for each challenger based on average gas prices, if the claim
is false.

:math:`avg_gp_l2a`
:math:`gas_{challenge}`
:math:`gas_{claim}`
:math:`gas_{withdraw}`


claimPeriod
-----------

``claimPeriod`` defines the period until a claim is considered to be finalized and cannot be
challenged anymore. If not challenged, an expired claim entitles the claimer to withdraw the funds
from the underlying request. The amount can only be withdrawn once. Note that it is technically
possible that there are multiple valid claims by different claimers. This case would only happen if
false claims are not challenged, which comes from protocol violation.


Rationale
^^^^^^^^^

The minimum claim period must ensure that at least one honest challenger is able to challenge a
false claim before it expires. Practical influencing factors also include experienced downtimes of
existing rollups. Experienced downtimes were as high as 17 hours.

As described above, a higher claim period increases the opportunity costs for honest claimers.


Proposed Values
^^^^^^^^^^^^^^^

``X = 1 day``


challengePeriod
---------------

The ``challengePeriod`` describes the minimum time a challenge game is open. This value depends on
the finalization parameter of the target rollup and thus may differ for each rollup instance. The
challenge game might be open longer than the challenge period defines.


Rationale
^^^^^^^^^

.. math:: X = finalization_{l2b} + c

Once a claim is challenged, it must be possible to resolve the dispute via L1 resolution. In order
to fulfill this requirement, ``challengePeriod`` must be higher than the finalization parameter of
the target rollup instance. For optimistic rollups this value is typically defined as 7 days but
this might change in the future and differ for each rollup implementation.  The reason behind this
is that the L1 resolver contract only sees fills on the target rollup after the finalization period
is over. That each challenged claim can be L1 resolved is a hard requirement. Otherwise, a challenge
could be won by placing enough stake in the challenge. This would limit the set of challengers which
are able to participate in the challenge game.

Additionally, the ``challengePeriod`` must include a time buffer :math:`c` after the finalization of
the target rollup happened. It avoids race conditions. After the finalization period of the target
rollup is reached, L1 resolution is possible. There must be enough time to actually execute L1
resolution before ``challengePeriod`` ends. This time is reflected in :math:`c`. The rationale for
choosing the exact value can be derived from ``claimPeriod``.


Proposed Values
^^^^^^^^^^^^^^^

.. code::

    finalization[l2b] = 7 days for all l2bs
    c = 1 day -> challengePeriod = 8 days


challengePeriodExtension
------------------------

``challengePeriodExtension`` defines the value for which the challenge period should be extended
after an event (challenge or counter challenge) happened. Each opponent should always have the time
to react in the challenge game, thus there must be enough time left for him to do so.


Rationale
^^^^^^^^^

To decide on the value we can refer to the same rationale as for ``claimPeriod``. Note that the
calculation for the new finalization of the current challenge is calculated as ``X = max(current
challenge end, time.now() + challengePeriodExtension)`` This is necessary to ensure that there is at
least ``challengePeriodExtension`` for the participant to react, but it might be possible that there
is even more time left. This comes from the initial ``challengePeriod`` value which depends on the
finalization period of the target rollup.


Proposed Value
^^^^^^^^^^^^^^

.. code::

    challengePeriod = claimPeriod = 1 day


Expiration time
---------------

Each request will have an expiration time set after which, if not claimed, the user is able to
withdraw the funds back. This mechanism ensures that no funds will be locked forever if nobody wants
or is able to fill the request.


Rationale
^^^^^^^^^

In order to prevent (accidental) misbehavior by the user, we can restrict expiration times by lower
and upper boundaries. Each LP has to decide within its own strategy how to react on certain
expiration times.  While setting a very low expiration time most likely leads to not being fulfilled
by any LP, an upper boundary ensures that funds can be withdrawn eventually.  With the current setup
of fixed fees and a race between LPs, we introduce a safety net for LPs to ensure that there is
enough time to register a claim of a filled request *before* it expires.


Proposed Values
^^^^^^^^^^^^^^^

.. code::

    minValidityPeriod = 5 minutes
    maxValidityPeriod = 52 weeks


Default Strategy
----------------
