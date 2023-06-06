#!/usr/bin/env bash
. "$(realpath $(dirname $0))/../scripts/common.sh"

ROOT="$(get_root_dir)"
OPTIMISM="${ROOT}/docker/optimism/optimism"

# Deployer's address & private key.
ADDRESS=0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266
PRIVKEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

CACHE_DIR=$(obtain_cache_dir $0)
DEPLOYMENT_DIR="${CACHE_DIR}/deployment"
DEPLOYMENT_CONFIG_FILE="${CACHE_DIR}/optimism-local.json"
KEYFILE="${CACHE_DIR}/${ADDRESS}.json"

ensure_keyfile_exists ${PRIVKEY} ${KEYFILE}
echo Beamer deployer\'s keyfile: ${KEYFILE}

down() {
    echo "Shutting down the end-to-end environment"
    make -C ${OPTIMISM}/ops down
}

up() {
    echo "Starting the end-to-end environment"
    docker_compose_file="-f ${OPTIMISM}/ops/docker-compose.yml"
    # FIXME: Need removal after: https://github.com/beamer-bridge/beamer/issues/1242
    export DOCKER_TAG_MESSAGE_RELAYER=0.5.25
    docker compose ${docker_compose_file} up --scale relayer=0 -d

    echo "Wait to make sure all services are up and running"
    # The current wait-for-sequencer.sh script in the optimism repo
    # has a bug in that it does not specify the configuration files.
    # So work around that here.
    WAIT_FOR_SEQUENCER_SCRIPT=$(mktemp)-wait-for-sequencer.sh
    sed "s#docker-compose#docker-compose ${docker_compose_file}#" \
            "${OPTIMISM}/ops/scripts/wait-for-sequencer.sh" > ${WAIT_FOR_SEQUENCER_SCRIPT}
    sh ${WAIT_FOR_SEQUENCER_SCRIPT}
}

create_deployment_config_file() {
    ADDRESS=$(addresses | jq '.["Proxy__OVM_L1CrossDomainMessenger"]')
    sed "s/\${l1_messenger_args}/${ADDRESS}/" \
        ${ROOT}/scripts/deployment/optimism-local-template.json \
        > ${DEPLOYMENT_CONFIG_FILE}
}

e2e_test() {
    l2_rpc=http://localhost:8545
    password=""
    contract_addresses="${CACHE_DIR}/addresses.json"
    echo Copying contract addresses to $contract_addresses
    docker exec ops-deployer-1 cat genesis/addresses.json > $contract_addresses
    e2e_test_fill ${DEPLOYMENT_DIR} ${KEYFILE} "${password}" $l2_rpc
    echo Sending Proof
    e2e_test_op_proof http://localhost:8545 $l2_rpc $CONTRACT_ADDRESSES $PRIVKEY $e2e_test_l2_txhash
    echo L1 Resolve
    e2e_test_relayer http://localhost:8545 $l2_rpc $CONTRACT_ADDRESSES $PRIVKEY $e2e_test_l2_txhash
    e2e_test_verify ${DEPLOYMENT_DIR} $l2_rpc $ADDRESS $e2e_test_request_id
}

usage() {
    cat <<EOF
$0  [up | down | addresses | deploy-beamer | e2e-test ]

Commands:
  up             Bring up a private Optimism instance.
  down           Stop the Optimism instance.
  addresses      List deployed Optimism contracts' addresses.
  deploy-beamer  Deploy Beamer contracts.
  e2e-test       Run a test that verifies L2 -> L1 -> L2 messaging.
EOF
}

addresses() {
    docker logs ops-deployer-1 2>/dev/null |
    sed -nE 's/deploying "([^"]+)" .+ deployed at (.+) with.*$/\1: \2/p' | sort | 
    poetry run python ${ROOT}/scripts/parse-addresses.py
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
