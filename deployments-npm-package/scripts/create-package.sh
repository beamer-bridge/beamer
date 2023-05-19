#!/bin/bash

rm -rf dist
mkdir -p dist/abis/{goerli,mainnet}
mkdir -p dist/artifacts

cp -r ../deployments/artifacts/. dist/artifacts

python ../scripts/generate-abi.py --only-abi ../deployments/artifacts/mainnet dist/abis/mainnet
cp ../deployments/goerli/*.* dist/abis/goerli

git rev-parse HEAD > git-commit-version.txt