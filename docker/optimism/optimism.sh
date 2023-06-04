#!/usr/bin/env bash
. "$(realpath $(dirname $0))/../scripts/common.sh"

ROOT="$(get_root_dir)"

# Deployer's address & private key.
ADDRESS=0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266
PRIVKEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

CACHE_DIR=$(obtain_cache_dir $0)
DEPLOYMENT_DIR="${CACHE_DIR}/deployment"
DEPLOYMENT_CONFIG_FILE="${CACHE_DIR}/optimism-local.json"
KEYFILE="${CACHE_DIR}/${ADDRESS}.json"
OPTIMISM="${CACHE_DIR}/optimism"
OPTIMISM_COMMIT_ID="6a474e36aba94f15ed90f71d1920e4b1d34513ab"

ensure_keyfile_exists ${PRIVKEY} ${KEYFILE}
echo Beamer deployer\'s keyfile: ${KEYFILE}

e2e_test_op_proof(){
    local l1_rpc=$1
    local l2_rpc=$2
    local privkey=$3
    local txhash=$4
    local relayer=${ROOT}/relayer/relayer-node18-linux-x64

    echo Starting OP relayer message prover...
    timeout 5m bash -c "until ${relayer} prove-op-message \
                                         --l1-rpc-url $l1_rpc \
                                         --l2-rpc-url $l2_rpc \
                                         --wallet-private-key $privkey \
                                         --l2-transaction-hash $txhash; \
    do sleep 1s; done"
}

configure_repo() {
    repo="https://github.com/ethereum-optimism/optimism.git"
    git init ${OPTIMISM}
    cd ${OPTIMISM}
    git fetch --depth 1 ${repo} ${OPTIMISM_COMMIT_ID} 
    git checkout ${OPTIMISM_COMMIT_ID}
}

run_on_op_launcher () {
    command=$1
    docker run -v /var/run/docker.sock:/var/run/docker.sock \
        -v ${OPTIMISM}:${OPTIMISM} \
        --network=host optimism-launcher:${OPTIMISM_COMMIT_ID} bash -c "${command}"
}

down() {
    echo "Shutting down the end-to-end environment"
    run_on_op_launcher "cd ${OPTIMISM} && make devnet-down && make devnet-clean"
}

build() {
    DOCKER_BUILDKIT=1 docker build ${ROOT}/docker/optimism -t optimism-launcher:${OPTIMISM_COMMIT_ID}
}

up() {
    echo "Starting the end-to-end environment"
    if [ ! -d ${OPTIMISM} ]; then
        configure_repo
    fi
    if [ -n "$(docker images -q optimism-launcher:latest)" ] || echo "does not exist"; then
        build
    fi
    run_on_op_launcher "cd ${OPTIMISM} && make devnet-up"
}

create_deployment_config_file() {
    ADDRESS='"0x6900000000000000000000000000000000000002"'
    sed "s/\${l1_messenger_args}/${ADDRESS}/" \
        ${ROOT}/scripts/deployment/optimism-local-template.json \
        > ${DEPLOYMENT_CONFIG_FILE}
}

e2e_test() {
    relayer=${ROOT}/relayer/relayer-node18-linux-x64
    l2_rpc=http://localhost:9545
    password=""
    
    e2e_test_fill ${DEPLOYMENT_DIR} ${KEYFILE} "${password}" $l2_rpc
    echo Sending Proof
    
    e2e_test_op_proof http://localhost:8545 $l2_rpc $PRIVKEY $e2e_test_l2_txhash
    echo L1 Resolve
    timeout 1m bash -c "until ${relayer} relay \
                                         --l1-rpc-url http://localhost:8545 \
                                         --l2-relay-to-rpc-url $l2_rpc \
                                         --l2-relay-from-rpc-url $l2_rpc \
                                         --wallet-private-key $PRIVKEY \
                                         --l2-transaction-hash $e2e_test_l2_txhash; \
                        do sleep 1s; done"
    e2e_test_verify ${DEPLOYMENT_DIR} $l2_rpc $ADDRESS $e2e_test_request_id
}

usage() {
    cat <<EOF
$0  [up | down | deploy-beamer | e2e-test ]

Commands:
  up             Bring up a private Optimism instance.
  down           Stop the Optimism instance.
  deploy-beamer  Deploy Beamer contracts.
  e2e-test       Run a test that verifies L2 -> L1 -> L2 messaging.
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
        create_deployment_config_file &&
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
