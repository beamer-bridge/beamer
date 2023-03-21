Command reference
-----------------




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

   * - ``--deployment-dir DIR``
     - The directory containing contract deployment files.

   * - ``--fill-wait-time TIME``
     - Time in seconds to wait for a fill event before challenging a false claim.
       Default: ``120``.

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

