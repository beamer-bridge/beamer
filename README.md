# raisync
Raisync - Bridging Roll ups with the L1 inherited security

## L1 resolution
For a working L1 resolution we need to transmit data about the filler of a given
request. In general rollups provide mechanisms for data exchange which are often
used to implement their own L1/L2 bridges. Optimism has some documentation
[here](https://community.optimism.io/docs/developers/bridge/messaging/).

Given the possibility to transmit information, there are two problems that need
to be solved: how to route the information to the correct source rollup and how
to make this information trustworthy.

### Routing

The proof of request fulfillment will always be written by the `FillManager`
contract on the target rollup and, in case a L1 resolution is triggered, must be
submitted to the `ResolutionRegistry` contract on the source rollup.

This process is started by the liquidity provider who fills an request. This
writes a proof on that rollup. This proof includes information about the
eligible claimer, the chain id of the source rollup and the request id. The
proof is basically an encoded transaction to the resolver, which can be executed
on L1.

The central role for routing this information correctly has the `Resolver`
contract, which is deployed on the shared L1 chain of both rollups. The resolver
holds a mapping of chain ids to the contract address of the `ResolutionRegistry`
on that chain.

When a proof transaction sent by the target rollup is executed, the resolver can
find the correct registry in the mapping and forward the information about the
eligible claimer. This again happens in form of an transaction, that can be
executed on the source rollup.

### Trust

To make sure that the resolved information is correct, only trusted contracts
must be allowed to take part in the message forwarding scheme. Otherwise bad
actors could freely write invalid proofs on the target rollup or even on the L1
chain.

Avoiding this requires whitelisting valid senders in all contracts on the path
of information.
- On the target rollup, the `ProofSubmitter` must only be callable by the
  `FillManager` contract.
- On L1, the resolver must only accept messages send by a whitelisted proof
  submitter for the given chain id.
- On the source rollup the registry must only accept transactions that have been
  sent by the L1 resolver.

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

### Measuring gas costs

To measure gas costs, simply invoke the following command:

```
   $ brownie test -G
```


A difference between two brownie gas profiles can be shown by using the
following command:

```
   $ python scripts/diff_gas_profiles.py <path-to-profile1> <path-to-profile2>
```

### Building documentation

To build Raisync documentation, make sure to have [Sphinx](https://www.sphinx-doc.org)
and [Graphviz](http://graphviz.org) installed. Documentation can be built by running

```
   $ make docs
```

and the resulting HTML will be available at `docs/build/index.html`.
