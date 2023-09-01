Command reference
-----------------

The Beamer software currently supports these commands:

* :ref:`command-agent` allows to run a Beamer agent.
* :ref:`command-config-read` reads contract configuration from the chain.
* :ref:`command-config-write` writes contract configuration to the chain.
* :ref:`command-health-check` analyzes the Beamer protocol and agent activity.
* :ref:`command-check-initiate-l1-invalidations` issues L1 invalidations.
* :ref:`command-check-verify-l1-invalidations` verifies L1 invalidations.
* :ref:`command-check-initiate-challenges` issues challenges.

.. _command-agent:

``beamer agent``
^^^^^^^^^^^^^^^^

The ``agent`` command will run a Beamer agent and provide liquidity for the bridge.

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
^^^^^^^^^^^^^^^^^^^^^^

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
^^^^^^^^^^^^^^^^^^^^^^^

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

``beamer health-check``
^^^^^^^^^^^^^^^^^^^^^^^

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
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

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
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

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
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

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
