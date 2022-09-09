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
	└── rinkeby
		├── deployment.json
		├── FillManager.json
		├── MintableToken.json
		├── RequestManager.json
		├── ResolutionRegistry.json
		└── Resolver.json

The above shows contract `deployment on Rinkeby`_.

The ``deployment.json`` file contains information on the chains that the
contracts have been deployed on, the contracts' addresses, as well as the block
number at the time of deployment.

The rest of the files contain contract ABI information which is needed by the agent.

.. _deployment on Rinkeby: https://github.com/beamer-bridge/beamer/tree/main/deployments/rinkeby

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

Make sure you have Python 3.9.x and
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
