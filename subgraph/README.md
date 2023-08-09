# Subgraph for beamerbridge

This package contains the subgraph files. 
The package is created with [thegraph](https://thegraph.com/).

## Setup

First create an .env file and fill it with the variables from the .env.example file.

## Some gotchas

Since beamerbridge is deployed on different chains, the subgraph node needs to index events from all those chains.
The node in docker compose is configured to watch for events on the chains you specify with the `GRAPH_ETHEREUM` 
variable. The variable accepts a string in the format `$CHAIN_NAME:$RPC_URL $CHAIN_NAME1:$RPC_URL1`. The `$CHAIN_NAME` 
should be the same as the one in the networks.json file.

What is being deployed on the node is inside the `build` directory (it's being generated after executing the
`yarn build --network $NETWORK_NAME` command).

The `build` command modifies the `subgraph.yaml` file by using the `network` and `startBlock` values from the 
networks.json file.

## How to deploy a graph to the local node

First execute the following command to start the node:
```
docker compose up -d
```
This will start the graph-node, postgres and ipfs containers in the background.

Then execute the following command to deploy the graph:
```
yarn codegen #this step can be omitted if you have already run it
yarn build --network $NETWORK_NAME
yarn create-local
yarn deploy-local --network $NETWORK_NAME
```
