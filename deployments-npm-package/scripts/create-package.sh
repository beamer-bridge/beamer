#!/bin/bash

rm -rf dist
mkdir -p dist/abis/{goerli,mainnet}
mkdir -p dist/abis-without-bytecode/{goerli,mainnet}
mkdir -p dist/artifacts

cp -r ../deployments/artifacts/. dist/artifacts

python ../scripts/generate-abi.py ../deployments/artifacts/mainnet dist/abis/mainnet
python ../scripts/generate-abi.py ../deployments/artifacts/goerli dist/abis/goerli

python ../scripts/generate-abi.py --only-abi ../deployments/artifacts/mainnet dist/abis-without-bytecode/mainnet
python ../scripts/generate-abi.py --only-abi ../deployments/artifacts/goerli dist/abis-without-bytecode/goerli

git rev-parse HEAD > git-commit-version.txt
