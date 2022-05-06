Contributing
============

Testing
-------

First make sure beamer is installed::

    poetry install

Then enter the virtual environment::

    poetry shell

Compile the contracts::

    pushd contracts && brownie compile && popd

Start ganache::

    ganache-cli --accounts 10 --hardfork istanbul --gasLimit 12000000 \
                --mnemonic brownie --port 8545 --chainId 1337

Create a JSON keyfile corresponding to one of the accounts pre-funded by ganache::

    python -c "import eth_account, json;
      acc = eth_account.Account.from_key('0x3ff6c8dfd3ab60a14f2a2d4650387f71fe736b519d990073e650092faaa621fa');
      obj = eth_account.account.create_keyfile_json(acc.key, b'');
      print(json.dumps(obj))" > 0x1CEE82EEd89Bd5Be5bf2507a92a755dcF1D8e8dc.json

Deploy the contracts on the local ganache test chain::

    python scripts/deployment/main.py --keystore-file 0x1CEE82EEd89Bd5Be5bf2507a92a755dcF1D8e8dc.json \
                                      --password '' \
                                      --test-messenger \
                                      --output-dir deployments/ganache-local \
                                      --config-file scripts/deployment/ganache-local.json

Generate the token match file::

    jq '[[["1337", .L2."1337".MintableToken.address]]]' < deployments/ganache-local/deployment.json > test-tokens.json

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

    beamer-agent --keystore-file 0x1CEE82EEd89Bd5Be5bf2507a92a755dcF1D8e8dc.json \
                 --password '' \
                 --l1-rpc-url http://localhost:8545 \
                 --l2a-rpc-url http://localhost:8545 \
                 --l2b-rpc-url http://localhost:8545 \
                 --deployment-dir deployments/ganache-local \
                 --token-match-file test-tokens.json \
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
                                     --target-token-address $(jq -r '.[0][0][1]' < test-tokens.json)


Working with a local Optimism instance
--------------------------------------

To setup a local Optimism instance and deploy Beamer contracts on it,
run::

    sh ./docker/optimism/optimism.sh up

This will start all the required containers, compile and deploy the contracts.
Note that it takes a while (~1 minute) for all the services to become ready
before we can deploy the contracts.

To stop and remove all the containers, simply run::

    sh ./docker/optimism/optimism.sh down

To get the contracts' addresses, run::

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

   brownie test -G

A difference between two brownie gas profiles can be shown by using the
following command::

   python scripts/diff_gas_profiles.py <path-to-profile1> <path-to-profile2>


Building documentation
----------------------

To build Beamer documentation, make sure to have `Sphinx <https://www.sphinx-doc.org>`_
and `Graphviz <http://graphviz.org>`_ installed. Documentation can be built by running::

   make docs

and the resulting HTML will be available at ``docs/build/index.html``.
