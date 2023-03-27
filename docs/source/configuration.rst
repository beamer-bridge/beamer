Configuration
=============


.. _config-agent:

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
    poll-period = 5.0
    confirmation-blocks = 0

    [account]
    path = "account.json"
    password = "test"

    [metrics]
    prometheus-port = 9101

    [base-chain]
    rpc-url = "GOERLI_TESTNET_RPC_URL"
    poll-period = 60.0

    [chains.goerli-arbitrum]
    rpc-url = "GOERLI_ARBITRUM_RPC_URL"
    confirmation-blocks = 1

    [chains.goerli-optimism]
    rpc-url = "GOERLI_OPTIMISM_RPC_URL"

    [tokens]
    # Each token is represented by a pair [chain-id, token-address].
    # All tokens within the same list are considered equivalent and
    # transfers between them are allowed.
    # A third value per token representation is optional, which defines
    # the allowance amount, the agent will approve to the fill manager contract.
    # [chain-id, token-address, allowance]
    # Allowed values are:
    # - Any value > 0, which defines the exact allowance given
    # - -1, the agent will approve type(uint256).max
    # If no value is given, the requested amount will be approved
    TST = [
        ["421613", "0x2644292EE5aed5c17BDcc6EDF1696ba802351cf6"],
        ["420", "0xAcF5e964b76773166F69d6E53C1f7A9114a8E01D"]
    ]

    USDC = [
        ["421613", "0x1a65113Fb92916EF0D3043D651b469b653763F16"],
        ["420", "0x6bCE0F297a204E1374860E0259EC31047a87B50F"]
    ]

In addition to the configuration file, one can specify command-line options which then
override settings from the configuration file. Details on available options can be found 
in the :ref:`command-agent` command reference.


Base Chain
~~~~~~~~~~

Base chain can be defined via the command-line options or configuration file, or
both. This chain is assumed to be the layer 1 chain used for L1 resolution.


Chains
~~~~~~

Chains can be defined via the command-line options or configuration file, or
both. 


Tokens
~~~~~~

The configuration file section ``[tokens]`` determines the set of ERC-20 tokens
that the agent will consider filling requests for. In other words, requests for
transferring tokens that are not in the set will be ignored.

A token definition looks like the following::

    NAME = [
        [CHAIN_ID_1, TOKEN_ADDRESS_1, ALLOWANCE],
        [CHAIN_ID_2, TOKEN_ADDRESS_2],
        ...
    ]

Each token is represented by a pair ``[CHAIN_ID, TOKEN_ADDRESS]``. All tokens
within the same list are considered equivalent and are part of the same class
named NAME. Only transfers between tokens of the same class are allowed.
A third value per token representation is optional, which defines
the allowance amount, the agent will approve to the fill manager contract.
The representation would look like ``[CHAIN_ID, TOKEN_ADDRESS, ALLOWANCE]``.
Allowed values are:

* Any value > 0, which defines the exact allowance given
* -1, the agent will approve with type(uint256).max (maximum allowance)

If no value is given, the requested amount will be approved.

Example::

    [tokens]
    TST = [
        ["11", "0x2644292EE5aed5c17BDcc6EDF1696ba802351cf6", "-1"],
        ["22", "0xAcF5e964b76773166F69d6E53C1f7A9114a8E01D", "100000000000"]
    ]

    USDC = [
        ["11", "0x1a65113Fb92916EF0D3043D651b469b653763F16"],
        ["22", "0x6bCE0F297a204E1374860E0259EC31047a87B50F"]
    ]

The above configuration says that the TST token contract on chain with ID ``11`` has
address ``0x2644292EE5aed5c17BDcc6EDF1696ba802351cf6``, while the TST token contract
on chain with ID ``22`` has address ``0xAcF5e964b76773166F69d6E53C1f7A9114a8E01D``.


Options reference
~~~~~~~~~~~~~~~~~

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

        deployment-dir = DIR

     - The directory containing contract deployment files.

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


.. _config-health-check:

Health Check configuration
--------------------------

The :ref:`command-health-check` command is configured by a TOML configuration file 
which is specified by the ``-c``/``--config`` option. 

An example configuration::

    agent-address=""
    deployment-dir="../deployments/mainnet"
    notification-system="telegram"

    [notification.rocketchat]
    url=""
    channel=""
    request-throttling-in-sec=60

    [notification.telegram]
    token=""
    chat-id=""
    request-throttling-in-sec=0

    [chains.arbitrum]
    rpc-url=""
    explorer="https://arbiscan.io/tx/"
    chain-id=42161

    [chains.optimism]
    rpc-url=""
    explorer="https://optimistic.etherscan.io/tx/"
    chain-id=10

    [tokens]
    # Each token is represented by a pair [chain-id, token-address].
    # All tokens within the same list are considered equivalent and
    # transfers between them are allowed.
    USDC = [
        ["10", "0x7F5c764cBc14f9669B88837ca1490cCa17c31607"],
        ["42161", "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8"]
    ]

Notification system
~~~~~~~~~~~~~~~~~~~

Depending on the notification system you want to use, you will have to set
``notification-system`` to ``rocketchat`` or ``telegram``.

If ``notification-system`` is set to ``rocketchat`` provide the following keys:

* ``notification.rocketchat.url``: The RocketChat webhook url where the message should be posted
* ``notification.rocketchat.channel``: The RocketChat channel where the message should be posted
* ``notification.rocketchat.request-trottling-in-sec``: Some RocketChat servers have a limit on how many messages can be
  posted in a given time. This parameter allows you to configure the time between messages.

If ``notification-system`` is set to ``telegram`` provide the following keys:

* ``notification.telegram.token``: The Telegram bot token
* ``notification.telegram.chat-id``: The Telegram chat id

To get a Telegram bot token, you need to contact the `@BotFather <https://t.me/BotFather>`_ on Telegram and first create a 
bot that will receive the notifications. When in chat with the BotFather, type ``/newbot`` and follow the instructions. Once
you've created the bot, the BotFather will give you a token. Copy that token and add it to the ``notification.telegram.token``.

Now, start a chat with the bot you just created and send a message to it. After that forward that message to the @myidbot. 
The myidbot will reply with your chat-id. Copy that id and add it to the ``notification.telegram.chat-id`` key.

That's it! Now you should have all the keys necessary to send notifications to Telegram.

Options reference
~~~~~~~~~~~~~~~~~

.. list-table::
   :header-rows: 1

   * - Configuration section / key
     - Description

   * - ::

        agent-address = ADDRESS

     - Address of the agent account.

   * - ::

        deployment-dir = PATH

     - Path to the deployment directory as it can be seen `here <https://github.com/beamer-bridge/beamer/tree/07d66e0bb8c76bb1ff219e24e34e1c24ee7890c6/deployments>`_.

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

