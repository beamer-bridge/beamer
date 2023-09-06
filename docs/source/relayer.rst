Cross-chain message relayer
===========================

This component is responsible for handling the cross-chain contract state updates. 

It is mainly used by the Agent software when resolving requests as a result of a running challenge game 
or for sending fill invalidation messages (L1 resolutions). However, it can also be used manually by running
the CLI commands.
If you haven't read about the role of :ref:`l1-resolutions` in Beamer, make sure you get familiar 
with this concept first.

Every **request fill** action creates a **proof** on the request destination chain.
Since these proofs are created on a different chain than the chain where the requests originated from,
we need a way to transport these proofs from one chain to another in order to be able 
to prove that a certain state is correct. This is where the cross-chain relayer comes into play.

The agent utilizes these proofs if and when needed. 
In normal operation, agent's claims will not be challenged so the fill proofs are not needed, therefore the agent will not invoke the relayer.
However, if a challenge game occurs, the agent has to make use of the proof to ensure it wins the game. 
Typically, that is done by invoking the relayer at an appropriate moment, i.e. when the proof becomes available for execution on Ethereum L1.

For instructions on how to setup, compile and run the relayer, make sure you take a look at the `/relayer/README.md` file.

Command reference
-----------------

The relayer CLI currently supports the following commands:


* :ref:`command-relay` relays a fill proof or a fill invalidation message from chain A to chain B.
* | :ref:`command-prove-op-message` proves on L1 that a message exists on L2. 
  | Used only for messages traveling from chains that are based on the *Optimism Bedrock* stack.

.. _command-relay:

``relay``
^^^^^^^^^

The ``relay`` command takes care of relaying a message from one chain to another (end-to-end).
In cases where a message needs to be relayed from an "Optimism Bedrock"-like chain, then one first needs to run
the :ref:`command-prove-op-message` command, for the same message that needs to be relayed, before one can run the :ref:`command-relay` command.


.. list-table::
   :header-rows: 1

   * - Command-line option 
     - Description

   * - ``--l1-rpc-url URL``
     - RPC URL to be used for communicating with the base chain.

   * - ``--l2-relay-to-rpc-url URL``
     - RPC URL to be used for communicating with the destination chain (chain where the proof is travelling *to*).

   * - ``--l2-relay-from-rpc-url URL``
     - RPC URL to be used for communicating with the source chain (chain where the proof is travelling *from*).

   * - ``--keystore-file PATH``
     - Path to the keystore file.

   * - ``--password PASSWORD``
     - Password of the keystore file.

   * - ``--l2-transaction-hash TX_HASH``
     - Transaction hash of the submitted message that needs to be relayed.

   * - ``--network-from PATH``
     - Path to a file with custom network configuration. This option is mainly used for development purposes.

   * - ``--network-to PATH``
     - Path to a file with custom network configuration. This option is mainly used for development purposes.


.. _command-prove-op-message:

``prove-op-message``
^^^^^^^^^^^^^^^^^^^^
The ``prove-op-message`` command is used only when a message needs to travel *from* "Optimism Bedrock"-like networks.
On such networks, there is a need of proving the message up front before it is treated as a message
that should be included in a batch and submitted to L1 (after the proof is finalized on L2).
The finality period starts only after the message was proven on L2.


.. list-table::
   :header-rows: 1

   * - Command-line option 
     - Description

   * - ``--l1-rpc-url URL``
     - RPC URL to be used for communicating with the base chain.

   * - ``--l2-rpc-url URL``
     - RPC URL to be used for communicating with the L2 chain.

   * - ``--keystore-file PATH``
     - Path to the keystore file.

   * - ``--password PASSWORD``
     - Password of the keystore file.

   * - ``--l2-transaction-hash TX_HASH``
     - Transaction hash of the submitted message that needs to be proven.

   * - ``--custom-network PATH``
     - Path to a file with custom L2 network configuration. This option is mainly used for development purposes.
