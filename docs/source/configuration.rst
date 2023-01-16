.. _config:

Agent configuration
-------------------

An agent can be configured via a configuration file or command line options, or a
combination of both. One can specify a TOML configuration file via the ``-c``/``--config``
option.

An example configuration::

    log-level = "debug"
    deployment-dir = "deployments/goerli"
    fill-wait-time = 120
    unsafe-fill-time = 600
    source-chain = "goerli-arbitrum"
    target-chain = "goerli-optimism"

    [account]
    path = "account.json"
    password = "test"

    [metrics]
    prometheus-port = 9101

    [chains.l1]
    rpc-url = "GOERLI_TESTNET_RPC_URL"

    [chains.goerli-arbitrum]
    rpc-url = "GOERLI_ARBITRUM_RPC_URL"

    [chains.goerli-optimism]
    rpc-url = "GOERLI_OPTIMISM_RPC_URL"

    [tokens]
    # Each token is represented by a pair [chain-id, token-address].
    # All tokens within the same list are considered equivalent and
    # transfers between them are allowed.
    TST = [
        ["421613", "0x2644292EE5aed5c17BDcc6EDF1696ba802351cf6"],
        ["420", "0xAcF5e964b76773166F69d6E53C1f7A9114a8E01D"]
    ]

    USDC = [
        ["421613", "0x1a65113Fb92916EF0D3043D651b469b653763F16"],
        ["420", "0x6bCE0F297a204E1374860E0259EC31047a87B50F"]
    ]

In addition to the configuration file, one can specify command-line options which then
override settings from the configuration file.

Chains can be specified on the command-line as follows::

    --chain l1="GOERLI_TESTNET_RPC_URL"
    --chain goerli-arbitrum="GOERLI_ARBITRUM_RPC_URL"
    --chain goerli-optimism="GOERLI_OPTIMISM_RPC_URL"

These three options are equivalent to the ``[chains]`` sections in the
configuration file example above. Details on available options can be found in
the :ref:`config-reference`.


Chains
^^^^^^

Chains can be defined via the command-line options or configuration file, or
both. A special chain named ``l1`` must be defined -- that chain is assumed to
be the layer 1 chain used for L1 resolution.


Tokens
^^^^^^

The configuration file section ``[tokens]`` determines the set of ERC-20 tokens
that the agent will consider filling requests for. In other words, requests for
transferring tokens that are not in the set will be ignored.

A token definition looks like the following::

    NAME = [
        [CHAIN_ID_1, TOKEN_ADDRESS_1],
        [CHAIN_ID_2, TOKEN_ADDRESS_2],
        ...
    ]

Each token is represented by a pair ``[CHAIN_ID, TOKEN_ADDRESS]``. All tokens
within the same list are considered equivalent and are part of the same class
named NAME. Only transfers between tokens of the same class are allowed.

Example::

    [tokens]
    TST = [
        ["11", "0x2644292EE5aed5c17BDcc6EDF1696ba802351cf6"],
        ["22", "0xAcF5e964b76773166F69d6E53C1f7A9114a8E01D"]
    ]

    USDC = [
        ["11", "0x1a65113Fb92916EF0D3043D651b469b653763F16"],
        ["22", "0x6bCE0F297a204E1374860E0259EC31047a87B50F"]
    ]

The above configuration says that the TST token contract on chain with ID ``11`` has
address ``0x2644292EE5aed5c17BDcc6EDF1696ba802351cf6``, while the TST token contract
on chain with ID ``22`` has address ``0xAcF5e964b76773166F69d6E53C1f7A9114a8E01D``.


.. _config-reference:

Reference
^^^^^^^^^

.. list-table::
   :header-rows: 1

   * - Command-line option 
     - Configuration section / key
     - Description

   * - ``--account-path PATH``
     - ::

        [account]
        path = PATH

     - Path to the account keyfile.

   * - ``--account-password PASSWORD``
     - ::

        [account]
        password = PASSWORD

     - The password needed to unlock the account.

   * - ``--deployment-dir DIR``
     - ::

        deployment-dir = DIR

     - The directory containing contract deployment files.

   * - ``--fill-wait-time TIME``
     - ::

        fill-wait-time = TIME

     - Time in seconds to wait for a fill event before challenging a false claim.
       Default: ``120``.

   * - ``--unsafe-fill-time TIME``
     - ::

        unsafe-fill-time = TIME

     - Time in seconds before request expiry, during which the agent will consider it
       unsafe to fill and ignore the request. Default: ``600``. For more info: :ref:`Unsafe Fill Time`

   * - ``--log-level LEVEL``
     - ::

        log-level = LEVEL

     - Logging level, one of ``debug``, ``info``, ``warning``, ``error``, ``critical``.
       Default: ``info``.

   * - ``--metrics-prometheus-port PORT``
     - ::

        [metrics]
        prometheus-port = PORT

     - Provide Prometheus metrics on the specified port.

   * - ``--source-chain NAME``
     - ::

        source-chain = NAME

     - Name of the source chain.

   * - ``--target-chain NAME``
     - ::

        target-chain = NAME

     - Name of the target chain.

   * - ``--chain NAME=URL``
     - ::

        [chains.NAME]
        rpc-url = URL

     - Associate a JSON-RPC endpoint URL with chain NAME. May be given multiple times.
       Command-line option example::

         --chain foo=http://foo.bar:8545

       Configuration file example::

        [chains.foo]
        rpc-url = "http://foo.bar:8545"

