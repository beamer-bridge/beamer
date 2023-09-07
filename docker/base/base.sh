#!/usr/bin/env bash
. "$(realpath $(dirname $0))/../scripts/common.sh"

# Deployer's address & private key.
ADDRESS=0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266
PRIVKEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

CACHE_DIR=$(obtain_cache_dir $0)
ARTIFACTS_DIR="${CACHE_DIR}/deployments/artifacts/local"
DEPLOYMENT_CONFIG_FILE="${CACHE_DIR}/901-base.json"
KEYFILE="${CACHE_DIR}/${ADDRESS}.json"
BASE="${CACHE_DIR}/base"
# Base uses op-node v1.1.1
OPTIMISM_COMMIT_ID="89ed69d80bbec7f2b1dd69e7e48cb7119839d58a"

ensure_keyfile_exists ${PRIVKEY} ${KEYFILE}
echo Beamer deployer\'s keyfile: ${KEYFILE}

configure_repo() {
    repo="https://github.com/ethereum-optimism/optimism.git"
    git init ${BASE}
    cd ${BASE}
    git fetch --depth 1 ${repo} ${OPTIMISM_COMMIT_ID} 
    git checkout ${OPTIMISM_COMMIT_ID}
    # Base uses op-geth v1.101106.0
    sed -i'' -e "s/optimism/v1.101106.0/" ops-bedrock/Dockerfile.l2
}

run_on_op_launcher () {
    command=$1
    docker run -v /var/run/docker.sock:/var/run/docker.sock \
        -v ${BASE}:${BASE} \
        --network=host base-launcher:${OPTIMISM_COMMIT_ID} bash -c "${command}"
}

down() {
    echo "Shutting down the end-to-end environment"
    run_on_op_launcher "cd ${BASE} && make devnet-down && make devnet-clean"
}

build() {
    DOCKER_BUILDKIT=1 docker build ${ROOT}/docker/optimism -t base-launcher:${OPTIMISM_COMMIT_ID}
}

up() {
    echo "Starting the end-to-end environment"
    if [ ! -d ${BASE} ]; then
        configure_repo
    fi
    if [ -n "$(docker images -q base-launcher:latest)" ] || echo "does not exist"; then
        build
    fi

    run_on_op_launcher "cd ${BASE} && make devnet-up"
}

create_deployment_config_file() {
    ADDRESS='"0x6900000000000000000000000000000000000002"'
    sed "s/\${l1_messenger_args}/${ADDRESS}/" \
        ${ROOT}/deployments/config/local/901-base.json \
        > ${DEPLOYMENT_CONFIG_FILE}
}

e2e_test() {
    relayer=$(get_relayer_binary)
    l2_rpc=http://localhost:9545
    password=""
    resolver=$(jq -r '.base.Resolver.address' ${ARTIFACTS_DIR}/base.deployment.json)
    
    e2e_test_fill $ARTIFACTS_DIR $l2_rpc $KEYFILE "${password}"
    echo Sending Proof
    
    e2e_test_op_proof http://localhost:8545 $l2_rpc $KEYFILE $e2e_test_l2_txhash
    echo L1 Resolve

    export RESOLVER=$resolver
    timeout 1m bash -c "until ${relayer} relay \
                                         --l1-rpc-url http://localhost:8545 \
                                         --l2-relay-to-rpc-url $l2_rpc \
                                         --l2-relay-from-rpc-url $l2_rpc \
                                         --keystore-file $KEYFILE \
                                         --password '' \
                                         --l2-transaction-hash $e2e_test_l2_txhash; \
                        do sleep 1s; done"
    e2e_test_verify $ARTIFACTS_DIR $l2_rpc $ADDRESS $e2e_test_request_id
}


e2e_test_fallback() {
    relayer=$(get_relayer_binary)
    l2_rpc=http://localhost:9545
    password=""
    resolver=$(jq -r '.base.Resolver.address' ${ARTIFACTS_DIR}/base.deployment.json)

    export SOURCE_CHAIN_ID=123
    e2e_test_fill $ARTIFACTS_DIR $l2_rpc $KEYFILE "${password}"
    echo Sending Proof
    
    e2e_test_op_proof http://localhost:8545 $l2_rpc $KEYFILE $e2e_test_l2_txhash
    echo L1 Resolve
    sleep 15

    export RESOLVER=$resolver
    # we need this relay call to fail
    if ${relayer} relay \
        --l1-rpc-url http://localhost:8545 \
        --l2-relay-to-rpc-url $l2_rpc \
        --l2-relay-from-rpc-url $l2_rpc \
        --keystore-file $KEYFILE \
        --password '' \
        --l2-transaction-hash $e2e_test_l2_txhash; then 
        echo Relayer failed to fail
        exit 1
    else
        echo Relayer failed as expected
    fi
    local output=$(poetry run python $ROOT/scripts/e2e-test-op-commands.py \
        ${KEYFILE} \
        "${password}" \
        http://localhost:8545 \
        verify-portal-call
    )
    export BLOCK_NUMBER=$(echo "$output" | awk -F: '/Block Number/ { print $2 }')
    poetry run python $ROOT/scripts/e2e-test-op-commands.py \
        ${KEYFILE} \
        "${password}" \
        http://localhost:8545 \
        set-chain-on-resolver \
        --abi-dir ${ABI_DIR} \
        $ARTIFACTS_DIR \
        "901-base.deployment.json" \
        $l2_rpc
    ${relayer} relay \
        --l1-rpc-url http://localhost:8545 \
        --l2-relay-to-rpc-url $l2_rpc \
        --l2-relay-from-rpc-url $l2_rpc \
        --keystore-file $KEYFILE \
        --password '' \
        --l2-transaction-hash $e2e_test_l2_txhash
    poetry run python $ROOT/scripts/e2e-test-op-commands.py \
        ${KEYFILE} \
        "${password}" \
        http://localhost:8545 \
        verify-messenger-call
    e2e_test_verify $ARTIFACTS_DIR $l2_rpc $ADDRESS $e2e_test_request_id
}

usage() {
    cat <<EOF
$0  [up | down | deploy-beamer | e2e-test | e2e-test-fallback]

Commands:
  up                    Bring up a private Base instance.
  down                  Stop the Base instance.
  deploy-beamer         Deploy Beamer contracts.
  e2e-test              Run a test that verifies L2 -> L1 -> L2 messaging.
  e2e-test-fallback     Run a test that verifies relayer's fallback mechanism.

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
        deploy_beamer ${KEYFILE} ${DEPLOYMENT_CONFIG_FILE} ${ARTIFACTS_DIR} 900
        ;;

    e2e-test)
        e2e_test
        ;;

    e2e-test-fallback)
        e2e_test_fallback
        ;;

    *)
        usage
        exit 1
        ;;
esac
