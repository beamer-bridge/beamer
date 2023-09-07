.. _glossary:


Glossary
========

.. glossary::

    agent
        A process, instance of ``beamer-agent``, running on behalf of a
        :term:`liquidity provider` and tasked with

         * fulfilling requests
         * defending own claims
         * challenging dishonest claims
         * collecting users' deposits and fees

        An agent only communicates with the Beamer smart contracts, never with other agents.

    agent fee
        The fee paid in token being moved, rewarding the :term:`liquidity
        provider`. Variable and currently set to ``max(5e18, 0.1% of token amount
        transferred)``. Collected by the agent.

    Beamer App
        The web application that one can use to transfer tokens between supported
        L2 chains.

    challenge game
        The part of the Beamer protocol that is concerned with making sure only
        the agent that fulfilled the request will be able to withdraw the
        :term:`user's deposit` and the fees.

        During the challenge game, the claimer and the challenger take turns
        increasing their stake in the game, until one of them decides to give
        up or initiate :term:`L1 resolution`.

        If L1 resolution is triggered, the winner of the game is determined by
        the outcome of L1 resolution.

        If L1 resolution is not triggered, the winner of the game is determined
        by the amount of staked native L2 tokens: whoever has most tokens wins.

    challenger
        An agent that decided to challenge an existing claim and therefore
        started the :term:`challenge game`.

    challenge stake
        The total amount of native L2 token, typically ETH, that is staked from
        both sides in the challenge game, i.e. the sum of :term:`challenger
        stake` and :term:`claimer stake`.

    challenger stake
        The amount of native L2 token that the challenger staked during the
        challenge game.

    claim
        A declaration issued by an agent to a Beamer smart contract that states
        that the agent fulfilled a specific request. Note that a claim can be
        made by anybody, regardless of whether the request was actually
        fulfilled or not.

        Agents have an incentive to challenge dishonest claims because by
        initiating and winning the :term:`challenge game` they win the
        :term:`claimer stake`.

    claim stake
        The amount of native L2 token that the claimer needs to stake in order
        to make a :term:`claim`.

    claimer stake
        The amount of native L2 token that the claimer staked during the
        challenge game, or the initial :term:`claim stake`.

    L1 resolution
        The process by which the winner of the :term:`challenge game` is
        determined if one of the game participants decides to escalate the game
        to the L1 chain. This involves providing the proof of request
        fulfillment to the Beamer smart contracts that then take care of
        communicating that information to the target L2 chain via the L1 chain.

    liquidity provider
        An entity providing funds to an agent or several agents. The funds are
        used to fulfill incoming requests. Liquidity providers earn a fee for
        each fulfilled request.

    LP
        See :term:`liquidity provider`.

    protocol fee
        The fee paid in token being moved, intended to support further
        development of the Beamer protocol. Variable and currently set to 0%
        of token amount transferred. Collected by the smart contract.

    request
        An action performed by a user wishing to transfer tokens from the
        source L2 chain to the target L2 chain. A request is typically created
        via the :term:`Beamer App`, but can also be made by manually interacting
        with the Beamer smart contracts.

        A requests comprises

          * the source L2 chain ID
          * the target L2 chain ID
          * the source token address
          * the target token address
          * the amount of tokens to be transferred

        When making a request, the user is required to deposit the appropriate
        amount of tokens, which are then locked until the request is either
        filled or expired.

    request validity period
        The amount of time that the request if valid for. If no agent fulfills
        the request within the validity period, the request is considered
        expired and the :term:`user's deposit` can be withdrawn by the user who
        made the request.

    user's deposit
        The amount of tokens that is locked with the Beamer's smart contract on
        the source chain. The tokens are locked until the corresponding request
        is fulfilled and an agent sucessfully claims and withdraws the tokens.

    PPM
        Percentage in parts per million as unit.
