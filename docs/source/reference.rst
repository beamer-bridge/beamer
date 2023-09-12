.. _reference:


Reference Documentation
=======================

Cross-chain Message Relayer
---------------------------

This component is responsible for handling the cross-chain contract state updates. 

It is mainly used by the Agent software when resolving requests as a result of a running challenge game 
or for sending fill invalidation messages (L1 resolutions). However, it can also be used manually by running
the CLI commands.
If you haven't read about the role of :ref:`contracts-l1-resolution` in Beamer, make sure you get familiar 
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

Command Reference
~~~~~~~~~~~~~~~~~

The relayer CLI currently supports the following commands:


* :ref:`command-relay` relays a fill proof or a fill invalidation message from chain A to chain B.
* | :ref:`command-prove-op-message` proves on L1 that a message exists on L2. 
  | Used only for messages traveling from chains that are based on the *Optimism Bedrock* stack.


.. _command-relay:

``relay``
"""""""""

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
""""""""""""""""""""
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


.. _reference-commandline:

beamer Command Reference
------------------------

The Beamer software currently supports these commands:

* :ref:`command-agent` allows to run a Beamer agent.
* :ref:`command-config-read` reads contract configuration from the chain.
* :ref:`command-config-write` writes contract configuration to the chain.
* :ref:`command-health-check` analyzes the Beamer protocol and agent activity.
* :ref:`command-check-initiate-l1-invalidations` issues L1 invalidations.
* :ref:`command-check-verify-l1-invalidations` verifies L1 invalidations.
* :ref:`command-check-initiate-challenges` issues challenges.
* :ref:`command-check-verify-challenges` verifies that challenges are resolved correctly.

.. _command-agent:

``beamer agent``
~~~~~~~~~~~~~~~~

.. list-table::
   :header-rows: 1

   * - Command-line option
     - Description

   * - ``--account-path PATH``
     - Path to the account keyfile.

   * - ``--account-password PASSWORD``
     - The password needed to unlock the account.

   * - ``--artifacts-dir DIR``
     - The directory containing deployment artifact files.

   * - ``--abi-dir DIR``
     - The directory containing contract abi files.

   * - ``--fill-wait-time TIME``
     - Time in seconds to wait for a fill event before challenging a false claim.
       Default: ``120``.

   * - ``--confirmation-blocks BLOCKS``
     - Number of confirmation blocks to consider the block ready for processing.
       Default: ``0``.

   * - ``--unsafe-fill-time TIME``
     - Time in seconds before request expiry, during which the agent will consider it
       unsafe to fill and ignore the request. Default: ``600``. For more info: :ref:`Unsafe Fill Time`

   * - ``--log-level LEVEL``
     - Logging level, one of ``debug``, ``info``, ``warning``, ``error``, ``critical``.
       Default: ``info``.

   * - ``--metrics-prometheus-port PORT``
     - Provide Prometheus metrics on the specified port.

   * - ``--source-chain NAME``
     - Name of the source chain. Deprecated and will be removed.
       No longer needed because the agent supports multiple chain pairs.

   * - ``--target-chain NAME``
     - Name of the target chain. Deprecated and will be removed.
       No longer needed because the agent supports multiple chain pairs.

   * - ``--chain NAME=URL``
     - Associate a JSON-RPC endpoint URL with chain NAME. May be given multiple times.
       Example::

         --chain foo=http://foo.bar:8545
    
   * - ``--poll-period``
     - Time in seconds which is waited before new events are fetched from the chains after 
       the last fetch. If a value for a specific chain is provided in the config file, it 
       takes precedence for this chain. Default: ``5.0``.


.. _command-config-read:

``beamer config read``
~~~~~~~~~~~~~~~~~~~~~~

``beamer config read --rpc-file RPC-FILE --abi-dir DIR --artifact CHAIN_ID-CHAIN_NAME.deployment.json STATE_PATH``

The command reads the latest contract configuration state from the chain and
store it into ``STATE_PATH``. If ``STATE_PATH`` already exists, it is used as
the starting point to fetch contract events from. Otherwise, contracts events
are fetched from the deployment block.

.. list-table::
   :header-rows: 1

   * - Command-line option
     - Description

   * - ``--abi-dir DIR``
     - The directory containing contract ABI files.

   * - ``--artifact CHAIN_ID-CHAIN_NAME.deployment.json``
     - Path to the deployment artifact.

   * - ``--rpc-file``
     - Path to the JSON file containing RPC information.

.. _command-config-write:

``beamer config write``
~~~~~~~~~~~~~~~~~~~~~~~

``beamer config write --rpc-file RPC-FILE --abi-dir DIR --artifact CHAIN_ID-CHAIN_NAME.deployment.json
CURRENT_STATE_PATH DESIRED_STATE_PATH``

The command reads current contract configuration from CURRENT_STATE_PATH and
the desired contract configuration from DESIRED_STATE_PATH and then issues
appropriate transactions to the chain to make the contract configuration match
the desired configuration.

.. list-table::
   :header-rows: 1

   * - Command-line option
     - Description

   * - ``--abi-dir DIR``
     - The directory containing contract ABI files.

   * - ``--artifact CHAIN_ID-CHAIN_NAME.deployment.json``
     - Path to the deployment artifact.

   * - ``--rpc-file``
     - Path to the JSON file containing RPC information.

   * - ``--keystore-file PATH``
     - Path to the keystore file.

   * - ``--password TEXT``
     - The password needed to unlock the keystore file.


.. _command-health-check:

``beamer health``
~~~~~~~~~~~~~~~~~

The ``health-check`` command scans the contracts for the emitted events and 
analyzes whether there is a missed fill, unclaimed transaction or a challenge 
game going on. In addition to this, if an ``agent-address`` is provided in the config 
file, the final notification will also include the liquidity on all chains for all the 
tokens specified inside the configuration file for the provided agent address. The 
command will notify the user by sending everything either to Telegram or RocketChat.

.. list-table::
   :header-rows: 1

   * - Command-line option 
     - Description

   * - ``--config PATH``
     - Path to the config file with chains configuration. 
       See :ref:`config-health-check` for available options.

   * - ``--log-level LEVEL``
     - Logging level, one of ``debug``, ``info``, ``warning``, ``error``, ``critical``.
       Default: ``error``.


.. _command-check-initiate-l1-invalidations:

``beamer check initiate-l1-invalidations``
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

``beamer check initiate-l1-invalidations [OPTIONS] PROOF_SOURCE PROOF_TARGET...``

The command initiates L1 invalidations from ``PROOF_SOURCE`` to each
``PROOF_TARGET`` (there must be at least one proof target, but also multiple ones
can be specified). ``PROOF_SOURCE`` and ``PROOF_TARGET`` are chain IDs. By
default, one invalidation will be sent per (source, target) pair, however this
may be changed via the ``--count`` option. If the output file (specified via
the ``--output`` option) already contains invalidations for a particular
(source, target) pair, the command will only send as many new invalidations for
the same pair as is necessary to reach the specified invalidation count per
pair. This also means that if the number of invalidations found for a given
pair is equal or greater to the count, no new invalidations will be sent.

.. list-table::
   :header-rows: 1

   * - Command-line option
     - Description

   * - ``--abi-dir DIR``
     - The directory containing contract ABI files.

   * - ``--artifacts-dir DIR``
     - The directory containing deployment artifact files.

   * - ``--rpc-file``
     - Path to the JSON file containing RPC information.

   * - ``--keystore-file PATH``
     - Path to the keystore file.

   * - ``--password TEXT``
     - The password needed to unlock the keystore file.

   * - ``--output PATH``
     - Path to store the invalidation info at, which can be later used for verification.

   * - ``--count INTEGER``
     - Number of invalidations to create, per (PROOF_SOURCE, PROOF_TARGET) pair.
       Has to be greater or equal to 1. Default: 1.


.. _command-check-verify-l1-invalidations:

``beamer check verify-l1-invalidations``
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

``beamer check verify-l1-invalidations [OPTIONS] FILE``

The command verifies L1 invalidations contained in ``FILE``. In case of
multiple invalidations for the same pair ``(proof_source, proof_target)``, if
an invalidation is verified successfully, remaining invalidations for the same
chain pair will be skipped as they are then not considered necessary. If a
verification fails for any invalidation, for whatever reason, an error will be
emitted and the process will continue with the next invalidation. The command
will exit with a success code only if all chain pairs had at least one
successful invalidation.

.. list-table::
   :header-rows: 1

   * - Command-line option
     - Description

   * - ``--abi-dir DIR``
     - The directory containing contract ABI files.

   * - ``--artifacts-dir DIR``
     - The directory containing deployment artifact files.

   * - ``--rpc-file``
     - Path to the JSON file containing RPC information.

   * - ``--keystore-file PATH``
     - Path to the keystore file.

   * - ``--password TEXT``
     - The password needed to unlock the keystore file.


.. _command-check-initiate-challenges:

``beamer check initiate-challenges``
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

``beamer check initiate-challenges [OPTIONS] FILL_CHAIN REQUEST_CHAIN...``

The command creates a transfer from each ``REQUEST_CHAIN`` to ``FILL_CHAIN``
and challenges agent's claims on those transfers so that the agent is forced to
prove its fills on L1. There must be at least one ``REQUEST_CHAIN``, but also
multiple ones can be specified. 

If the output file (specified via the ``--output`` option) already contains
challenges for a particular (source, target) pair, the command will perform
only actions that are necessary to complete the set of challenges. For example,
if transfer requests, as well as and challenge transactions have already been
done for all chain pairs, no additional transactions will be made.


.. list-table::
   :header-rows: 1

   * - Command-line option
     - Description

   * - ``--abi-dir DIR``
     - The directory containing contract ABI files.

   * - ``--artifacts-dir DIR``
     - The directory containing deployment artifact files.

   * - ``--rpc-file``
     - Path to the JSON file containing RPC information.

   * - ``--keystore-file PATH``
     - Path to the keystore file.

   * - ``--password TEXT``
     - The password needed to unlock the keystore file.

   * - ``--output PATH``
     - Path to store the challenges info at, which can be later used for verification.

   * - ``--stake FLOAT``
     - Stake amount for each challenge, in ETH.
       Has to be greater or equal to 0.1. Default: 0.1.

   * - ``--token TEXT``
     - Symbol of the token to be used for challenges (e.g. USDC).


.. _command-check-verify-challenges:

``beamer check verify-challenges``
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

``beamer check verify-challenges [OPTIONS] FILE``

The command verifies that each challenge stored in ``FILE`` was resolved correctly
via L1.


.. list-table::
   :header-rows: 1

   * - Command-line option
     - Description

   * - ``--abi-dir DIR``
     - The directory containing contract ABI files.

   * - ``--artifacts-dir DIR``
     - The directory containing deployment artifact files.

   * - ``--rpc-file``
     - Path to the JSON file containing RPC information.


.. _reference-configuration:

Configuration File Reference
----------------------------

.. _reference-agent-configuration:

Agent configuration file
~~~~~~~~~~~~~~~~~~~~~~~~

.. list-table::
   :header-rows: 1

   * - Configuration section / key
     - Description

   * - ::

        [account]
        path = PATH

     - Path to the account keyfile.

   * - ::

        [account]
        password = PASSWORD

     - The password needed to unlock the account.

   * - ::

        artifacts-dir = DIR

     - The directory containing deployment artifact files.

   * - ::

        abi-dir = DIR

     - The directory containing contract abi files.

   * - ::

        fill-wait-time = TIME

     - Time in seconds to wait for a fill event before challenging a false claim.
       Default: ``120``.

   * - ::

        confirmation-blocks = BLOCKS

     - Number of confirmation blocks to consider the block ready for processing.
       Default: ``0``.

   * - ::

        unsafe-fill-time = TIME

     - Time in seconds before request expiry, during which the agent will consider it
       unsafe to fill and ignore the request. Default: ``600``. For more info: :ref:`Unsafe Fill Time`

   * - ::

        log-level = LEVEL

     - Logging level, one of ``debug``, ``info``, ``warning``, ``error``, ``critical``.
       Default: ``info``.

   * - ::

        [metrics]
        prometheus-port = PORT

     - Provide Prometheus metrics on the specified port.

   * - ::

        source-chain = NAME

     - Name of the source chain. Deprecated and will be removed.
       No longer needed because the agent supports multiple chain pairs.


   * - ::

        target-chain = NAME

     - Name of the target chain. Deprecated and will be removed.
       No longer needed because the agent supports multiple chain pairs.

   * - ::

        [base-chain]
        rpc-url = URL

     - Associate a JSON-RPC endpoint URL with base chain.

   * - ::

        [chains.NAME]
        rpc-url = URL

     - Associate a JSON-RPC endpoint URL with chain NAME. May be given multiple times.
       Example::

        [chains.foo]
        rpc-url = "http://foo.bar:8545"

   * - ::

        poll-period = TIME

     - Time in seconds to wait between two consecutive RPC requests for new events.
       The value applies to all chains that don't have the chain-specific poll period defined.
       Default: ``5.0``.

   * - ::

        [chains.NAME]
        poll-period = TIME

     - Time in seconds to wait between two consecutive RPC requests for new events.
       The value applies only to chain NAME, taking precedence over the global poll period.

   * - ::

        min-source-balance = ETH

     - Minimum ETH balance on source chain to fill requests on target chain..
       The value applies to all chains that don't have the chain-specific min-source-balance defined.
       Default: ``0.1``.

   * - ::

        [chains.NAME]
        min-source-balance = ETH

     - Minimum ETH balance on chain NAME to fill requests originating from it.
       The value applies only to chain NAME, taking precedence over the global min-source-balance.


.. _config-health-check:

Health-check configuration file
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

.. list-table::
   :header-rows: 1

   * - Configuration section / key
     - Description

   * - ::

        agent-address = ADDRESS

     - Address of the agent account.

   * - ::

        artifacts-dir = PATH

     - The directory that stores deployment artifact files.

   * - ::

        abi-dir = PATH

     - Path to the contract abi files directory.

   * - ::

        notification-system = SYSTEM

     - The notification system to use, either ``telegram`` or ``rocketchat``.

   * - ::

        
        [notification.rocketchat]
        url = URL

     - URL of the RocketChat server where the notifications should be sent to.

   * - ::

        
        [notification.rocketchat]
        channel = NAME

     - Name of the RocketChat channel where the notifications should be sent to.

   * - ::

        
        [notification.telegram]
        token = TOKEN

     - Specifies the Telegram authentication token.

   * - ::

        
        [notification.telegram]
        chat-id = ID

     - The ID of the chat where the notification should be sent to.

   * - ::

        
        [notification.SYSTEM]
        request-throttling-in-sec = TIME

     - Throttles the notifications to the specified number of seconds.

   * - ::

        [chains.NAME]
        rpc-url = URL

     - Associate a JSON-RPC endpoint URL with chain NAME. May be given multiple times.
       Example::

        [chains.foo]
        rpc-url = "http://foo.bar:8545"

   * - ::

        [chains.NAME]
        explorer = URL

     - Specifies the transaction URL path of a block explorer for the chain NAME.
   
   * - ::

        [chains.NAME]
        chain-id = CHAIN_ID

     - The chain id for chain NAME.

   * - ::

        [tokens]
        NAME = [
          [CHAIN_ID, TOKEN_ADDRESS],
          [CHAIN_ID, TOKEN_ADDRESS]
        ]

     - Specifies the token NAME. For each chain a pair [CHAIN_ID, TOKEN_ADDRESS] is added to the list.


.. _reference-contract-parameters:

Contracts API Reference 
-----------------------

.. autosolcontract:: FillManager
.. autosolcontract:: RequestManager
.. autosolcontract:: Resolver

Helper contracts
~~~~~~~~~~~~~~~~

.. autosolcontract:: RestrictedCalls


Interfaces
~~~~~~~~~~

.. autosolinterface:: IMessenger
