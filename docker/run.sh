#!/usr/bin/env bash

function finish() {
# Implement logs download
#   echo -e "\nGet the log files of the run services"
#   docker cp "$DOCKER_CONTAINER_NAME":/var/log/supervisor/. ./logs/ || true
  echo -e "\nShutting down the end-to-end environment"
  docker-compose down || true
}


echo -e "\nStarting the end-to-end environment"
docker-compose -f docker-compose-nobuild.yml up -d

echo -e "\nWait to make sure all services are up and running"
sleep 10s

# It'ds currently not possible to define networks in a per-project way
# Instead, update the config
poetry run brownie networks add Ethereum l1 host="http://0.0.0.0:9545" chainid=1337 || true
poetry run brownie networks add Ethereum l2 host="http://0.0.0.0:8545" chainid=420 || true

# Deploy contracts
cd contracts/ && poetry run brownie run deploy.py --network l2

# Run tests

trap finish EXIT
