#!/usr/bin/env bash
. "$(realpath $(dirname $0))/../scripts/common.sh"

ROOT="$(get_root_dir)"

# Deployer's address & private key.
ADDRESS=0x1CEE82EEd89Bd5Be5bf2507a92a755dcF1D8e8dc
PRIVKEY=0x3ff6c8dfd3ab60a14f2a2d4650387f71fe736b519d990073e650092faaa621fa

CACHE_DIR=$(obtain_cache_dir "$0")
DEPLOYMENT_DIR="${CACHE_DIR}/deployment"
DEPLOYMENT_CONFIG_FILE="${ROOT}/scripts/deployment/ethereum-local.json"
KEYFILE="${CACHE_DIR}/${ADDRESS}.json"

ensure_keyfile_exists ${PRIVKEY} ${KEYFILE}
echo Beamer deployer\'s keyfile: ${KEYFILE}

down() {
    echo "Shutting down the end-to-end environment"
    PID=$(ps -ef | awk '/[g]anache --wallet.accounts/{print $2}')

    if [ -n "$PID" ]; then
        kill -9 $PID;
    fi
}

up() {
    echo Starting the end-to-end environment
    # Fund the account with 1000 ETH
    ganache --wallet.accounts $PRIVKEY,0x3635C9ADC5DEA00000 &>/dev/null &
}

e2e_test() {
    l2_rpc=http://0.0.0.0:8545
    password=""
    l2_messenger=$(cat ${DEPLOYMENT_DIR}/deployment.json | jq -r '.chains."1337".EthereumL2Messenger.address')

    e2e_test_fill ${DEPLOYMENT_DIR} ${KEYFILE} "${password}" $l2_rpc

    export ETHEREUM_L2_MESSENGER=$l2_messenger

    e2e_test_relayer $l2_rpc $l2_rpc "" $PRIVKEY $e2e_test_l2_txhash
    e2e_test_verify ${DEPLOYMENT_DIR} $l2_rpc $ADDRESS $e2e_test_request_id
}

usage() {
    cat <<EOF
$0  [up | down | deploy-beamer | e2e-test ]

Commands:
  up             Bring up a local blockchain.
  down           Stop the local blockchain.
  deploy-beamer  Deploy Beamer contracts.
  e2e-test       Run a test that verifies L2 ETH -> L1 ETH -> L2 ETH messaging.
EOF
}

case $1 in
    up)
        up
    ;;

    down)
        down
    ;;

    deploy-beamer)
        deploy_beamer ${KEYFILE} ${DEPLOYMENT_CONFIG_FILE} ${DEPLOYMENT_DIR}
    ;;

    e2e-test)
        e2e_test
    ;;

    *)
        usage
        exit 1
    ;;
esac
