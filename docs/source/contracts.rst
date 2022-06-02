Beamer contracts
================


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

  FillManager -> ProofSubmitter -> L2Messenger -> Resolver -> L1Messenger -> ResolutionRegistry

The ``Resolver`` contract is deployed on L1 and is used by all L2 chains.

Messenger contracts are specific to L2 chains and are responsible for

* sending messages to the other side (an instance of ``L1Messenger`` is deployed
  on L1 and sends messages to the L2 chain it is related to;
  similarly, an instance of ``L2Messenger`` is deployed on its L2
  chain and sends messages to L1)
* answering the question "where did this message really come from?"
  (this is because the ``msg.sender`` will be the rollup's messenger contract that
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
   ``ResolutionRegistry``      L2        
   ======================= ===========

.. table:: Interface contracts (chain‑dependent)
   :widths: auto

   ======================= ===========    
   Contract                Deployed on
   ======================= ===========       
   ``L1Messenger``             L1
   ``L2Messenger``             L2
   ``ProofSubmitter``          L2
   ======================= ===========
