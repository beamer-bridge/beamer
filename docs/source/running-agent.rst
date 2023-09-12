.. _running_agent:


Running an Agent
================

.. _running-agent-prerequisites:

Prerequisites
-------------

There are two ways to run a Beamer agent: via :ref:`a container image <agent-container>`
and :ref:`directly from source <agent-from-source>`.

.. _running-agent-configuration:

Configuring the Agent
---------------------

An agent can be configured via a configuration file or command line options, or a
combination of both. One can specify a TOML configuration file via the ``-c``/``--config``
option.

An example configuration::

    log-level = "debug"
    artifacts-dir = "deployments/artifacts/goerli"
    abi-dir = "deployments/abis/goerli"
    fill-wait-time = 120
    unsafe-fill-time = 600
    poll-period = 5.0
    confirmation-blocks = 0
    min-source-balance = 0.1

    [account]
    path = "account.json"
    password = "test"

    [metrics]
    prometheus-port = 9101

    [base-chain]
    rpc-url = "GOERLI_TESTNET_RPC_URL"

    [chains.goerli-arbitrum]
    rpc-url = "GOERLI_ARBITRUM_RPC_URL"
    confirmation-blocks = 1
    poll-period = 60.0
    min-source-balance = 0.2

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


Configuring the Health Check
----------------------------

The :ref:`command-health-check` command is configured by a TOML configuration file
which is specified by the ``-c``/``--config`` option.

An example configuration::

    agent-address=""
    artifacts-dir="../deployments/artifacts/mainnet"
    abi-dir="../deployments/abis/mainnet"
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


.. _running-agent-deployment-info:

Getting the Contract Deployment Information
-------------------------------------------

During the Beamer contracts' deployment process, a directory with deployment information is created.
The directory typically looks like this::

  deployments/
  └── artifacts/
    └── goerli/
      ├── base.deployment.json
      ├── 5-ethereum.deployment.json
      ├── 420-optimism.deployment.json
      ├── 421613-arbitrum.deployment.json
      └── 84531-base.deployment.json

The above shows contract `artifacts on Goerli`_.

The ``<chain-id>-<chain-name>.deployment.json`` files contain information on specific chain that the
contracts have been deployed on, the contracts' addresses, as well as the block
number at the time of deployment.

The rest of the files contain contract ABI information which is needed by the agent.

.. _artifacts on Goerli: https://github.com/beamer-bridge/beamer/tree/main/deployments/artifacts/goerli

.. _running-agent-starting:

Starting an agent
-----------------

.. _agent-container:

Running an agent container
~~~~~~~~~~~~~~~~~~~~~~~~~~

To run an agent container simply do::

    docker run --name beamer_agent ghcr.io/beamer-bridge/beamer agent   --account-path <path> \
                                                                        --account-password <password> \
                                                                        --base-chain <l1-rpc-url> \
                                                                        --chain source=<source-l2-rpc-url> \
                                                                        --chain target=<target-l2-rpc-url> \
                                                                        --artifacts-dir <artifacts-dir> \
                                                                        --abi-dir <abi-dir> \
                                                                        --source-chain source \
                                                                        --target-chain target

.. _agent-from-source:

Running directly from source
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

First clone the Beamer repository::

    git clone https://github.com/beamer-bridge/beamer.git

Make sure you have Python 3.10.x and
`Poetry <https://python-poetry.org/>`_ installed.

Enter the virtual environment::

    cd beamer
    poetry shell

and install ``beamer-agent``::

    poetry install

While still inside the virtual environment, run::

    beamer agent --account-path <path> \
                 --account-password <password> \
                 --base-chain <l1-rpc-url> \
                 --chain source=<source-l2-rpc-url> \
                 --chain target=<target-l2-rpc-url> \
                 --artifacts-dir <artifacts-dir> \
                 --abi-dir <abi-dir> \
                 --source-chain source \
                 --target-chain target

.. _running-agent-stopping:

Stopping an agent
-----------------

You may want to stop your agent when there is an update to the software.

To describe how to update an agent, it is worth to have a look on Beamer's versioning scheme. As described in
:ref:`development-branching`, each major version describes a different mainnet deployment thus a different set of contracts.
Please note, that if you update your agent to a new major version, it will run on different contracts. Updating to a
new major version requires different steps for you to safely transition to a new major contract version.
A minor (e.g. 1.X.0 -> 1.Y.0) or a patch (e.g. 1.2.X -> 1.2.Y) version upgrade typically brings with it a
set of fixes and it is recommended to switch to a newer version sooner rather than later.
The difference between the minor and patch version updates is that the former may bring a
change in command line options, configuration file settings or similar things where some user
attention may be required, while the patch version update should be completely painless.

Update to a new agent release
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Running your agent in a container, it is as easy as updating your image in the docker-compose.yml to the latest version.
The repo https://github.com/beamer-bridge/run-your-own-agent is actively maintained and will provide you with the
most up-to-date agent version. Alternatively you will find the latest version under
https://github.com/beamer-bridge/beamer/releases.

Update to a new major version
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
When updating to a new major version (i.e. X.0.0 -> Y.0.0) and thus to a new contract deployment, it is recommended to
setup a fresh agent instance following the guidelines from https://github.com/beamer-bridge/run-your-own-agent. Please
keep the old agent running and leave it temporarily untouched.
As soon as the contracts are paused, the old agent should run for at least another 24 hours to ensure withdrawal of
outstanding funds. The old agent can then be shut down safely.


.. _running-agent-troubleshooting:

Troubleshooting
---------------

When there is a problem, you can get the logs via::

    docker logs beamer_agent -f
