Running an agent
================

There are two ways to run a Beamer agent: via :ref:`a container image <agent-container>`
and :ref:`directly from source <agent-from-source>`.  Regardless of the way it is run,
an agent requires the following:

 * An account that is sufficiently funded on both L2 chains.

   Related options: ``--keystore-file``, ``--password``

   .. :note: The same address is being used for both chains.

 * URL of the L1 chain's RPC server.

   Related options: ``--l1-rpc-url``

 * URL of the source L2 chain's RPC server.

   Related options: ``--l2a-rpc-url``

 * URL of the target L2 chain's RPC server.

   Related options: ``--l2b-rpc-url``

 * A directory containing Beamer contracts' deployment information.
   See  :ref:`deployment-info`.

   Related options: ``--deployment-dir``

 * A file containing information on matching token contracts.
   See  :ref:`token-match-file`.

   Related options: ``--token-match-file``


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
		├── OptimismProofSubmitter.json
		├── RequestManager.json
		├── ResolutionRegistry.json
		└── Resolver.json

The above shows contract `deployment on Rinkeby`_.

The ``deployment.json`` file contains information on the chains that the
contracts have been deployed on, the contracts' addresses, as well as the block
number at the time of deployment.

The rest of the files contain contract ABI information which is needed by the agent.

.. _deployment on Rinkeby: https://github.com/beamer-bridge/beamer/tree/main/deployments/rinkeby


.. _token-match-file:

The token match file
--------------------

An example token match file is a JSON file that specifies the relation between tokens
on various chains. For example, the following::

	[
		[
			["28", "0xfE7B1466A7A7F2C1DaE2c557207A8FF524e160AE"],
			["588", "0xfE7B1466A7A7F2C1DaE2c557207A8FF524e160AE"]
		],
		[
			["41", "0x1231EB253849c1Ae2355888B1be2dcc7C12F8101"],
			["17", "0x9adC0f0a7c0C7dBC536A0719b8395F8BDd1fD176"],
			["23", "0xcaf202511B457702E00Da61336Da050B319103ee"]
		],
	]

describes two token groups, where all the token inside the same group are
considered equivalent.  As an example, a group may contain DAI on Boba and DAI
on Metis, but if it contains those two, it should not contain USDC, regardless
of the chain, because USDC is not equivalent to DAI.

Each token is represented as list of two elements, ``[chain_id, token_address]``,
and a list of such lists forms a group. On the topmost level we simply have a list
of all groups.

In the example above, we have two tokens in the first group, one on chain 28
and the other on chain 588.  The second group consists of three tokens.

For an in-repo example, see
https://github.com/beamer-bridge/beamer/blob/main/beamer/data/tokens.example.json.

.. _agent-container:

Running an agent container
--------------------------

To run an agent container simply do::

    docker run ghcr.io/beamer-bridge/beamer-agent --keystore-file <keyfile> \
                                                  --password <keyfile-password> \
                                                  --l1-rpc-url <l1-rpc-url> \
                                                  --l2a-rpc-url <source-l2-rpc-url> \
                                                  --l2b-rpc-url <target-l2-rpc-url> \
                                                  --deployment-dir <contract-deployment-dir> \
                                                  --token-match-file <token-match-file>

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

    beamer-agent --keystore-file <keyfile> \
                 --password <keyfile-password> \
                 --l1-rpc-url <l1-rpc-url> \
                 --l2a-rpc-url <source-l2-rpc-url> \
                 --l2b-rpc-url <target-l2-rpc-url> \
                 --deployment-dir <contract-deployment-dir> \
                 --token-match-file <token-match-file>
