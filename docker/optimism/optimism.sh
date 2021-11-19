#!/usr/bin/env bash

ROOT=$(dirname $(dirname $(dirname "$(realpath "$0")")))
DOCKER_COMPOSE_FILE="${ROOT}/docker/optimism/docker-compose-nobuild.yml"

function down {
    echo -e "\nShutting down the end-to-end environment"
    docker-compose -f "${DOCKER_COMPOSE_FILE}" down
}

function up {
    echo -e "\nStarting the end-to-end environment"
    docker-compose -f "${DOCKER_COMPOSE_FILE}" up -d

    echo -e "\nWait to make sure all services are up and running"
    sleep 40

    # It's currently not possible to define networks in a per-project way
    # Instead, update the config
    poetry run brownie networks list | grep -q l1 || \
        poetry run brownie networks add Ethereum l1 host="http://0.0.0.0:9545" chainid=1337
    poetry run brownie networks list | grep -q l2 || \
        poetry run brownie networks add Ethereum l2 host="http://0.0.0.0:8545" chainid=420

    rm -rf "${ROOT}/contracts/build/deployments/"
    # Deploy contracts
    pushd "${ROOT}/contracts"
    poetry run brownie run deploy.py --network l2
    popd
}

function usage() {
    cat <<EOF
$0  [up | down]

Commands:
  up        Bring up a private Optimism instance. Deploy Raisync contracts on it.
  down      Stop the Optimism instance.
EOF
}

case $1 in
    up)
        up
        ;;

    down)
        down
        ;;

    *)
        usage
        exit 1
        ;;
esac
