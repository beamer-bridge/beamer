# Beamer's cross-chain message relayer

This software component provides a CLI that can be used to relay messages between two networks.

## Setup

Pre-requisites:

- [Node.js >=18.x](https://nodejs.org/en)

Start by installing the dependencies

```
yarn install
```

## Compile the TS code

```
yarn build
```

## Run

There are two ways to run the CLI commands.

1. By using the TS runtime enviroment `ts-node` (preferred in dev mode)

```
yarn ts-node ./src/cli.ts <command> [options]
```

2. By using node after running the [compilation step above](#compile-the-ts-code)

```
node ./build/src/cli.js <command> [options]
```

You can find more info on the available commands and their respective options [here](https://docs.beamerbridge.com/relayer).

Additionally, these commands and options can be listed by invoking the CLI with the `--help` option.

## Run unit tests

```
yarn test:unit
```

## Lint files

```
yarn lint
```

## Fix lint errors

```
yarn lint:fix
```
