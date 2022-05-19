#!/usr/bin/env bash
nth_parent() {
    local n=$1
    local path=$2
    while [ $n -gt 0 ]; do
        path=$(dirname "$path");
        ((n--))
    done
    echo $path
}


ROOT="$(nth_parent 3 "$(realpath "$0")")"
NITRO="$ROOT/docker/arbitrum/nitro"

DEPLOYMENT_DIR=$(mktemp -d)
ADDRESS=0x1CEE82EEd89Bd5Be5bf2507a92a755dcF1D8e8dc
PRIVKEY=0x3ff6c8dfd3ab60a14f2a2d4650387f71fe736b519d990073e650092faaa621fa
KEYFILE=$(mktemp -d)/${ADDRESS}.json
echo Beamer deployer\'s keyfile: ${KEYFILE}

poetry run python ${ROOT}/scripts/generate_account.py --key ${PRIVKEY} ${KEYFILE}

down() {
    echo "Shutting down the end-to-end environment"
    docker-compose -f ${NITRO}/docker-compose.yaml down
}

setup_brownie_chains() {
    # It's currently not possible to define networks in a per-project way.
    # Instead, update the config.
    # First, remove the old networks, if any.
    brownie networks delete l1 >/dev/null 2>&1 || true
    brownie networks delete l2 >/dev/null 2>&1 || true

    poetry run brownie networks add Ethereum l1 host="http://0.0.0.0:8545" chainid=1337
    poetry run brownie networks add Ethereum l2 host="http://0.0.0.0:8547" chainid=421612
}

deploy_contracts() {
    pushd "${ROOT}"
    poetry run python scripts/deployment/main.py \
        --keystore-file ${KEYFILE} \
        --password '' \
        --output-dir ${DEPLOYMENT_DIR} \
        --config-file scripts/deployment/arbitrum-local.json \
        --test-messenger \
        --allow-same-chain
    popd
}

wait_for_sequencer() {
    local RETRIES=90
    local i=0
    until docker logs nitro-sequencer-1 2>&1 | grep -q "HTTP server started";
    do
        echo 'Waiting for sequencer...'
        sleep 2
        if [ $i -eq $RETRIES ]; then
            echo 'Timed out waiting for sequencer'
            break
        fi
        ((i=i+1))
    done
}

fund_account() {
    ${NITRO}/test-node.bash script send-l1 --ethamount 100 --to address_${ADDRESS}
    ${NITRO}/test-node.bash script send-l2 --ethamount 100 --to address_${ADDRESS}
    # Wait a bit for the transactions to go through
    sleep 3
}

up() {
    echo Starting the end-to-end environment
    # We need to patch the test-node.bash script so that it does not ask for
    # confirmation when given the --init option.
    PATCHED_TEST_NODE=${NITRO}/.test-node-patched.bash
    sed -E 's/^(run=true)$/\1\nforce_init=true/' ${NITRO}/test-node.bash \
        > ${PATCHED_TEST_NODE}
    chmod +x ${PATCHED_TEST_NODE}

    ${PATCHED_TEST_NODE} --init --detach --no-blockscout

    wait_for_sequencer
    setup_brownie_chains
    fund_account
    deploy_contracts
}

usage() {
    cat <<EOF
$0  [up | down ]

Commands:
  up           Bring up a private Arbitrum instance. Deploy Beamer contracts on it.
  down         Stop the Arbitrum instance.
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
