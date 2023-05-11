#!/bin/bash

rm -rf dist
mkdir -p dist/abis/{goerli,mainnet}
mkdir -p dist/artifacts

cp -r artifacts/ dist/artifacts

python ../scripts/generate-abi.py --only-abi artifacts/mainnet dist/abis/mainnet
cp goerli/*.* dist/abis/goerli
