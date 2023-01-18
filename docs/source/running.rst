Running an agent
================

There are two ways to run a Beamer agent: via :ref:`a container image <agent-container>`
and :ref:`directly from source <agent-from-source>`.  Regardless of the way it is run,
an agent requires the following:

 * An account that is sufficiently funded on both L2 chains.

   Related options: ``--account-path``, ``--account-password``

   .. :note: The same address is being used for both chains.

 * Names and RPC endpoints of the L1 chain, source and target chains.

   Related options: ``--source-chain``, ``--target-chain``, ``--chain``

   .. :note: The ``--chain`` option can be given multiple times to define multiple chains.

 * A directory containing Beamer contracts' deployment information.
   See  :ref:`deployment-info`.

   Related options: ``--deployment-dir``


For a detailed explanation of configuration options, see :ref:`config`.


.. _deployment-info:

The contracts' deployment information
-------------------------------------

During the Beamer contracts' deployment process, a directory with deployment information is created.
The directory typically looks like this::

	deployments/
	└── goerli
		├── deployment.json
		├── FillManager.json
		├── MintableToken.json
		├── OptimismL1Messenger.json
		├── OptimismL2Messenger.json
		├── RequestManager.json
		└── Resolver.json

The above shows contract `deployment on Goerli`_.

The ``deployment.json`` file contains information on the chains that the
contracts have been deployed on, the contracts' addresses, as well as the block
number at the time of deployment.

The rest of the files contain contract ABI information which is needed by the agent.

.. _deployment on Goerli: https://github.com/beamer-bridge/beamer/tree/main/deployments/goerli

.. _agent-container:

Running an agent container
--------------------------

To run an agent container simply do::

    docker run ghcr.io/beamer-bridge/beamer-agent --account-path <path> \
                                                  --account-password <password> \
                                                  --chain l1=<l1-rpc-url> \
                                                  --chain source=<source-l2-rpc-url> \
                                                  --chain target=<target-l2-rpc-url> \
                                                  --deployment-dir <contract-deployment-dir> \
                                                  --source-chain source \
                                                  --target-chain target

.. _agent-from-source:

Running directly from source
----------------------------

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

    beamer-agent --account-path <path> \
                 --account-password <password> \
                 --chain l1=<l1-rpc-url> \
                 --chain source=<source-l2-rpc-url> \
                 --chain target=<target-l2-rpc-url> \
                 --deployment-dir <contract-deployment-dir> \
                 --source-chain source \
                 --target-chain target

Updating an agent
-----------------

To describe how to update an agent, it is worth to have a look on Beamer's versioning scheme. As described in
:ref:`branching_strategy`, each major version describes a different mainnet deployment thus a different set of contracts.
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
outstanding funds. The old agent can then be shutdown safely.
