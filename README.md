# raisync
Raisync - Bridging Roll ups with the L1 inherited security


### Working with a local Optimism instance

To setup a local Optimism instance and deploy Raisync contracts on it,
run

```
sh ./docker/optimism/optimism.sh up
```

This will start all the required containers, compile and deploy the contracts.
Note that it takes a while (~1 minute) for all the services to become ready
before we can deploy the contracts.

To stop and remove all the containers, simply run
```
sh ./docker/optimism/optimism.sh down
```

To get the contracts' addresses, run
```
sh ./docker/optimism/optimism.sh addresses
```

### Testing

First make sure raisync is installed:

```
   $ poetry install
```

Then enter the virtual environment:

```
   $ poetry shell
```

- Start ganache:

```
   $ ganache-cli --accounts 10 --hardfork istanbul --gasLimit 12000000 --mnemonic brownie --port 8545
```

- Compile and deploy the contracts:

```
   $ pushd contracts && brownie compile && brownie run deploy && popd
```

- Create a JSON keyfile corresponding to one of the accounts pre-funded by ganache:

```
   $ python -c "import eth_account, json;
     acc = eth_account.Account.from_key('0x3ff6c8dfd3ab60a14f2a2d4650387f71fe736b519d990073e650092faaa621fa');
     obj = eth_account.account.create_keyfile_json(acc.key, b'');
     print(json.dumps(obj))" > 0x1CEE82EEd89Bd5Be5bf2507a92a755dcF1D8e8dc.json
```

- Mint some test tokens:

```
   $ python scripts/mint.py --contract-deployment contracts/build/deployments/dev/0x5FbDB2315678afecb367f032d93F642f64180aa3.json \
                            --recipient 0x1CEE82EEd89Bd5Be5bf2507a92a755dcF1D8e8dc \
                            --keystore-file 0x1CEE82EEd89Bd5Be5bf2507a92a755dcF1D8e8dc.json \
                            --password ''
```

- Start raisync:

```
   $ raisync --keystore-file 0x1CEE82EEd89Bd5Be5bf2507a92a755dcF1D8e8dc.json \
             --password '' \
             --l2a-rpc-url http://127.0.0.1:8545 \
             --l2b-rpc-url http://127.0.0.1:8545 \
             --l2a-contracts-deployment-dir contracts/build/deployments/dev \
             --l2b-contracts-deployment-dir contracts/build/deployments/dev
```

- Submit a request:

```
   $ python scripts/request.py --keystore-file 0x1CEE82EEd89Bd5Be5bf2507a92a755dcF1D8e8dc.json \
                               --password '' \
                               --source-token-address 0x5FbDB2315678afecb367f032d93F642f64180aa3 \
                               --target-token-address 0x5FbDB2315678afecb367f032d93F642f64180aa3 \
                               --target-address 0x33A4622B82D4c04a53e170c638B944ce27cffce3 \
                               --target-chain-id 1337 \
                               --amount 1
```

### Running the frontend prototype

Requires:
- Node.js
- yarn

First install the dependencies:

```
cd frontend
yarn install
```

Run the development server:

```
yarn serve
```

To configure the used deployment, make your changes to the `frontend/.env.development` file and rerun the development server.
