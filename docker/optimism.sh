#!/usr/bin/env bash
ROOT=$(dirname $(dirname "$(realpath "$0")"))
DOCKER_COMPOSE_FILES="-f ${ROOT}/raisync/docker/optimism/ops/docker-compose.yml -f ${ROOT}/raisync/docker/optimism/ops/docker-compose-nobuild.yml"

down() {
    echo -e "\nShutting down the end-to-end environment"
    echo "${DOCKER_COMPOSE_FILES}"
    docker-compose "${DOCKER_COMPOSE_FILES}" down
}

up() {
    echo -e "\nStarting the end-to-end environment"
    docker-compose "{DOCKER_COMPOSE_FILES}" --scale relayer=1 -d

    echo -e "\nWait to make sure all services are up and running"
    sh "${ROOT}/docker/optimism/ops/scripts/wait-for-sequencer.sh"

    # It's currently not possible to define networks in a per-project way
    # Instead, update the config
    poetry run brownie networks list | grep -q l1 || \
        poetry run brownie networks add Ethereum l1 host="http://0.0.0.0:9545" chainid=1337
    poetry run brownie networks list | grep -q l2 || \
        poetry run brownie networks add Ethereum l2 host="http://0.0.0.0:8545" chainid=420

    rm -rf "${ROOT}/contracts/build/deployments/"
}

check1() {
    pushd "${ROOT}/contracts"
    poetry run brownie run check_l1.py --network l1
    popd
}

setup() {
    rm -r contracts/build/deployments &&
    addresses &&
    cat addresses.json &&
    cd "${ROOT}/contracts" &&
    poetry run brownie run deploy_l1.py --network l1 &&
    poetry run brownie run deploy_optimism.py --network l2 &&
    poetry run brownie run setup_l1.py --network l1 &&
    poetry run brownie run check_l2.py --network l2
}

usage() {
    cat <<EOF
$0  [up | down | addresses]

Commands:
  up           Bring up a private Optimism instance. Deploy Raisync contracts on it.
  down         Stop the Optimism instance.
  addresses    List deployed contracts' addresses.
  e2e          Run a simple end-to-end test.
EOF
}

addresses() {
    docker logs ops_deployer_1 2>/dev/null | \
    sed -nE 's/deploying "([^"]+)" .+ deployed at (.+) with.*$/\1: \2/p' | sort | \
    python scripts/parse-addresses.py
}

case $1 in
    up)
        up
        ;;

    down)
        down
        ;;

    addresses)
        addresses
        ;;

    e2e)
        e2e
        ;;

    *)
        usage
        exit 1
        ;;
esac
