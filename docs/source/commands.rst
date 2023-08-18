Command reference
-----------------

The Beamer software currently supports these commands:

* :ref:`command-agent` allows to run a Beamer agent.
* :ref:`command-config-read` reads contract configuration from the chain.
* :ref:`command-config-write` writes contract configuration to the chain.
* :ref:`command-health-check` analyzes the Beamer protocol and agent activity.

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

