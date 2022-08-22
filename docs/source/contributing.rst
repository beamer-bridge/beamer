Contributing
============

Requirements
------------

- `Python <https://www.python.org>`_ 3.9
- `poetry <https://python-poetry.org>`_
- `ganache <https://trufflesuite.com/ganache>`_ 7
- `prettier-plugin-solidity <https://github.com/prettier-solidity/prettier-plugin-solidity>`_


Testing
-------

First make sure beamer is installed::

    poetry install

Then enter the virtual environment::

    poetry shell

Compile the contracts::

    brownie compile

Start ganache::

    ganache --wallet.totalAccounts 10 --chain.hardfork london --miner.blockGasLimit 12000000 \
            --wallet.mnemonic brownie --server.port 8545 --chain.chainId 1337

Create a JSON keyfile corresponding to one of the accounts pre-funded by ganache::

    python scripts/generate_account.py --key 0x3ff6c8dfd3ab60a14f2a2d4650387f71fe736b519d990073e650092faaa621fa \
                                       --password '' \
                                       0x1CEE82EEd89Bd5Be5bf2507a92a755dcF1D8e8dc.json

Deploy the contracts on the local ganache test chain::

    python scripts/deployment/main.py --keystore-file 0x1CEE82EEd89Bd5Be5bf2507a92a755dcF1D8e8dc.json \
                                      --password '' \
                                      --output-dir deployments/ganache-local \
                                      --config-file scripts/deployment/ganache-local.json \
                                      --deploy-mintable-token

Generate a config file with token definition::

    TOKEN_ADDR=$(jq -r '.L2."1337".MintableToken.address' < deployments/ganache-local/deployment.json)
    echo -e "[tokens]\nTST = [[\"1337\", \"$TOKEN_ADDR\"]]"  > agent-ganache-local.conf

Mint some test tokens::

    python scripts/call_contracts.py --keystore-file 0x1CEE82EEd89Bd5Be5bf2507a92a755dcF1D8e8dc.json \
                                     --password '' \
                                     --eth-rpc http://localhost:8545 \
                                     --deployment-dir deployments/ganache-local \
                                     mint

Whitelist the agent's address::

    python scripts/call_contracts.py --keystore-file 0x1CEE82EEd89Bd5Be5bf2507a92a755dcF1D8e8dc.json \
                                     --password '' \
                                     --eth-rpc http://localhost:8545 \
                                     --deployment-dir deployments/ganache-local \
                                     whitelist 0x1CEE82EEd89Bd5Be5bf2507a92a755dcF1D8e8dc

Start ``beamer-agent``::

    beamer-agent --account-path 0x1CEE82EEd89Bd5Be5bf2507a92a755dcF1D8e8dc.json \
                 --account-password '' \
                 --config agent-ganache-local.conf \
                 --chain l1=http://localhost:8545 \
                 --source-chain=l1 \\
                 --target-chain=l1 \\
                 --deployment-dir deployments/ganache-local \
                 --log-level debug

Submit a request::

    python scripts/call_contracts.py --deployment-dir deployments/ganache-local \
                                     --keystore-file 0x1CEE82EEd89Bd5Be5bf2507a92a755dcF1D8e8dc.json \
                                     --password '' \
                                     --eth-rpc http://localhost:8545 \
                                     request \
                                     --amount 1 \
                                     --target-address 0x1CEE82EEd89Bd5Be5bf2507a92a755dcF1D8e8dc \
                                     --target-chain-id 1337 \
                                     --target-token-address $TOKEN_ADDR


Working with a local Optimism instance
--------------------------------------

To start a local Optimism instance, run::

    sh ./docker/optimism/optimism.sh up

This will start all the required containers. Note that it takes a while (~1
minute) for all the services to become ready. Next, deploy the Beamer
contracts and start the end-to-end test::

    sh ./docker/optimism/optimism.sh deploy-beamer
    sh ./docker/optimism/optimism.sh e2e-test

To stop and remove all the containers, simply run::

    sh ./docker/optimism/optimism.sh down

To list Optimism contracts' addresses, run::

    sh ./docker/optimism/optimism.sh addresses


Running the frontend
--------------------

Dependencies:

* Node.js
* yarn

First install the dependencies::

    cd frontend
    yarn install

Run the development server::

    yarn dev

To configure the used deployment, make your changes to the
``frontend/.env.development`` file and rerun the development server.


Measuring gas costs
-------------------

To measure gas costs, simply invoke the following command::

   brownie test -G beamer/tests/contracts

A difference between two brownie gas profiles can be shown by using the
following command::

   python scripts/diff_gas_profiles.py <path-to-profile1> <path-to-profile2>


Building documentation
----------------------

To build Beamer documentation, make sure to have `Sphinx <https://www.sphinx-doc.org>`_
and `Graphviz <http://graphviz.org>`_ installed. Documentation can be built by running::

   make docs

and the resulting HTML will be available at ``docs/build/index.html``.
