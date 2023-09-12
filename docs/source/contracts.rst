.. _contracts:


Beamer Contracts
================


.. _contracts-architecture:

Architecture
------------

The following figure shows the Beamer contract architecture:

.. graphviz:: contracts.dot
   :align: center
   :caption: Beamer contracts

Contracts in purple rectangles are chain-dependent. Red lines indicate
restricted calls. Dashed red lines indicate restricted calls that cross the
L1-L2 boundary. Black lines represent ordinary, unrestricted calls.

Here, "a restricted call" means "a call that only a specific caller is allowed to make".
For example, the ``L1Messenger`` contract may only be called by the ``Resolver`` contract.
In this way, a chain of trust is established to ensure that L1 resolution is safe.
The complete trusted call chain is::

  FillManager -> L2Messenger -> Resolver -> L1Messenger -> RequestManager

The ``Resolver`` contract is deployed on L1 and is used by all L2 chains.

Messenger contracts are specific to L2 chains and are responsible for

* sending messages to the other side (an instance of ``L1Messenger`` is deployed
  on L1 and sends messages to the L2 chain it is related to;
  similarly, an instance of ``L2Messenger`` is deployed on its L2
  chain and sends messages to L1)
* answering the question "where did this message really come from?"
  (this is because the ``msg.sender`` will be the chain's messenger contract that
  relayed the message, not the original message sender)

The following tables list Beamer contracts. It should be noted that the
interfacing contracts are chain-dependent and are mostly used to facilitate
message transfer between L1 and L2.

.. table:: Core contracts (chain-independent)
   :widths: auto

   ======================= ===========
   Contract                Deployed on
   ======================= ===========
   ``RequestManager``          L2
   ``FillManager``             L2
   ``Resolver``                L1
   ======================= ===========

.. table:: Interface contracts (chain‑dependent)
   :widths: auto

   ======================= ===========
   Contract                Deployed on
   ======================= ===========
   ``L1Messenger``             L1
   ``L2Messenger``             L2
   ======================= ===========


.. _contracts-parameters:

Parameters
----------

.. table:: Core contracts parameters
   :widths: auto

   +----------------------+----------------------------+---------------------------------------+
   | Contract             | Parameter                  | Explanation                           |
   +======================+============================+=======================================+
   | RequestManager       | claimStake                 | Minimum amount of source chain's      |
   |                      |                            | native token to claim in WEI.         |
   |                      +----------------------------+---------------------------------------+
   |                      | claimRequestExtension      | Additional time given to claim a      |
   |                      |                            | request in seconds.                   |
   |                      +----------------------------+---------------------------------------+
   |                      | claimPeriod                | The period for which the claim is     |
   |                      |                            | valid in seconds.                     |
   |                      +----------------------------+---------------------------------------+
   |                      | challengePeriodExtension   | Additional time given after challenge |
   |                      |                            | in seconds.                           |
   |                      +----------------------------+---------------------------------------+
   |                      | minFeePPM                  | PPM to determine minLPFee profit for  |
   |                      |                            | liquidity providers.                  |
   |                      +----------------------------+---------------------------------------+
   |                      | lpFeePPM                   | PPM from transfer amount to determine |
   |                      |                            | LP`s fee.                             |
   |                      +----------------------------+---------------------------------------+
   |                      | protocolFeePPM             | PPM from transfer amount to determine |
   |                      |                            | protocol`s fee.                       |
   |                      +----------------------------+---------------------------------------+
   |                      | MIN_VALIDITY_PERIOD        | Minimum validity period of            |
   |                      |                            | a request in seconds.                 |
   |                      +----------------------------+---------------------------------------+
   |                      | MAX_VALIDITY_PERIOD        | Maximum validity period of            |
   |                      |                            | a request in seconds.                 |
   |                      +----------------------------+---------------------------------------+
   |                      | CLAIM_ID_WITHDRAWN_EXPIRED | Maximum validity period of            |
   |                      |                            | a request.                            |
   |                      +----------------------------+---------------------------------------+
   |                      | currentNonce               | Counter to calculate request and      |
   |                      |                            | claim IDs.                            |
   |                      +----------------------------+---------------------------------------+
   |                      | chains                     | Maps chain IDs to chain               |
   |                      |                            | information.                          |
   |                      +----------------------------+---------------------------------------+
   |                      | requests                   | Maps request IDs to                   |
   |                      |                            | requests.                             |
   |                      +----------------------------+---------------------------------------+
   |                      | claims                     | Maps claim IDs to                     |
   |                      |                            | claims.                               |
   |                      +----------------------------+---------------------------------------+
   |                      | tokens                     | Maps ERC20 token addresses to         |
   |                      |                            | tokens.                               |
   +----------------------+----------------------------+---------------------------------------+
   | FillManager          | messenger                  | Used to send proofs to                |
   |                      |                            | L1.                                   |
   |                      +----------------------------+---------------------------------------+
   |                      | l1Resolver                 | Resolver contract address to use      |
   |                      |                            | for L1 Resolution.                    |
   +----------------------+----------------------------+---------------------------------------+
   |                      | fills                      | Maps request IDs to                   |
   |                      |                            | fill IDs.                             |
   +----------------------+----------------------------+---------------------------------------+
   | Resolver             | sourceChainInfos           | Maps source chain IDs to              |
   |                      |                            | source chain infos.                   |
   +----------------------+----------------------------+---------------------------------------+


.. _contracts-l1-resolution:

L1 Resolution
-------------

For a working L1 resolution we need to transmit data about the filler of a given
request. In general chains provide mechanisms for data exchange which are often
used to implement their own L1/L2 bridges. Optimism has some documentation `here
<https://community.optimism.io/docs/developers/bridge/messaging/>`_.

Given the possibility to transmit information, there are two problems that need
to be solved: how to route the information to the correct source chain and how
to make this information trustworthy.

Routing
~~~~~~~

The proof of request fulfillment will always be written by the ``FillManager``
contract on the target chain and, in case a L1 resolution is triggered, must be
submitted to the ``RequestManager`` contract on the source chain.

This process is started by the liquidity provider who fills a request. This
writes a proof on that chain. This proof includes information about the
filler, the chain id of the source chain and the request id. The proof is
basically an encoded transaction to the resolver, which can be executed
on L1.

The central role for routing this information correctly has the ``Resolver``
contract, which is deployed on the shared base chain of both chains. The resolver
holds a mapping of chain ids to the contract address of the ``RequestManager``
on that chain.

When a proof transaction sent by the target chain is executed, the resolver can
find the correct request manager in the mapping and forward the information about the
filler. This again happens in form of a transaction, that can be executed on the
source chain.

Trust
~~~~~

To make sure that the resolved information is correct, only trusted contracts
must be allowed to take part in the message forwarding scheme. Otherwise, bad
actors could freely write invalid proofs on the target chain or even on the L1
chain.

Avoiding this requires whitelisting valid senders in all contracts on the path
of information.

* On the target chain, the messenger contract must only be callable by the ``FillManager`` contract.
* On L1, the resolver must only accept messages sent by a whitelisted L2 messenger for the given chain id.
* On the source chain the request manager must only accept transactions that have been sent by the L1 messenger.

API Reference
-------------

Please see the section :ref:`reference-contract-parameters`