#!/usr/bin/env bash
. "$(realpath $(dirname $0))/../scripts/common.sh"

ROOT="$(get_root_dir)"
NITRO="${ROOT}/docker/arbitrum/nitro"

# Deployer's address & private key.
ADDRESS=0x1CEE82EEd89Bd5Be5bf2507a92a755dcF1D8e8dc
PRIVKEY=0x3ff6c8dfd3ab60a14f2a2d4650387f71fe736b519d990073e650092faaa621fa

CACHE_DIR=$(obtain_cache_dir $0)
DEPLOYMENT_DIR="${CACHE_DIR}/deployment"
DEPLOYMENT_CONFIG_FILE="${CACHE_DIR}/arbitrum-local.json"
KEYFILE="${CACHE_DIR}/${ADDRESS}.json"

ensure_keyfile_exists ${PRIVKEY} ${KEYFILE}
echo Beamer deployer\'s keyfile: ${KEYFILE}

TEST_NODE_SCRIPT="${CACHE_DIR}/test-node-patched.bash"

patch_test_node_script() {
    # We need to patch the test-node.bash script so that it
    # 1) does not ask for confirmation when given the --init option
    # 2) uses the correct working directory
    [ -f ${TEST_NODE_SCRIPT} ] || {
        sed -E "s#^(run=true)\$#\1\nforce_init=true#;
                s#^mydir=\`dirname .0\`#mydir=${NITRO}#" \
            ${NITRO}/test-node.bash > ${TEST_NODE_SCRIPT}
        chmod +x ${TEST_NODE_SCRIPT}
    }
}

patch_test_node_script

down() {
    echo "Shutting down the end-to-end environment"
    docker-compose -f ${NITRO}/docker-compose.yaml down
}

wait_for_sequencer() {
    local RETRIES=180
    local i=0
    until docker logs nitro-sequencer-1 2>&1 | grep -q "HTTP server started";
    do
        echo 'Waiting for sequencer...'
        sleep 1
        if [ $i -eq $RETRIES ]; then
            echo 'Timed out waiting for sequencer'
            break
        fi
        ((i=i+1))
    done
}

fund_account() {
    ${TEST_NODE_SCRIPT} script send-l1 --ethamount 100 --to address_${ADDRESS}
    ${TEST_NODE_SCRIPT} script send-l2 --ethamount 100 --to address_${ADDRESS}
    # Wait a bit for the transactions to go through
    sleep 3
}

up() {
    echo Starting the end-to-end environment
    ${TEST_NODE_SCRIPT} --init --detach --no-blockscout
    wait_for_sequencer
    fund_account
}

create_deployment_config_file() {
    # get the address of the bridge contract, we need to configure that
    # address as the native messenger for our L1 messenger since the bridge
    # will be delivering our message
    BRIDGE=$(docker exec nitro-sequencer-1 jq -r .bridge /config/deployment.json)
    BRIDGE=\"$(echo $BRIDGE | python -c 'import eth_utils; print(eth_utils.to_checksum_address(input()))')\"

    INBOX=$(docker exec nitro-sequencer-1 jq -r .inbox /config/deployment.json)
    INBOX=\"$(echo $INBOX | python -c 'import eth_utils; print(eth_utils.to_checksum_address(input()))')\"

    sed "s/\${l1_messenger_args}/${BRIDGE}, ${INBOX}/" \
        ${ROOT}/scripts/deployment/arbitrum-local-template.json \
        > ${DEPLOYMENT_CONFIG_FILE}
}

e2e_test() {
    l2_rpc=http://0.0.0.0:8547
    password=""
    relayer=${ROOT}/relayer/relayer-node18-linux-x64
    l1_messenger=$(cat ${DEPLOYMENT_DIR}/deployment.json | jq -r '.base_chain.ArbitrumL1Messenger.address')

    network_config="${CACHE_DIR}/localnetwork.json"
    echo Copying network config to $network_config
    docker-compose -f ${NITRO}/docker-compose.yaml run --entrypoint sh testnode-tokenbridge \
                   -c "cat localNetwork.json" > $network_config

    e2e_test_fill ${DEPLOYMENT_DIR} ${KEYFILE} "${password}" $l2_rpc

    export ARBITRUM_L1_MESSENGER=$l1_messenger
    echo Starting relayer...
    ${relayer} --l1-rpc-url http://0.0.0.0:8545 \
               --l2-relay-to-rpc-url $l2_rpc \
               --l2-relay-from-rpc-url $l2_rpc \
               --network-to $network_config \
               --network-from $network_config \
               --wallet-private-key $PRIVKEY \
               --l2-transaction-hash $e2e_test_l2_txhash

    e2e_test_verify ${DEPLOYMENT_DIR} $l2_rpc $ADDRESS $e2e_test_request_id
}


usage() {
    cat <<EOF
$0  [up | down | deploy-beamer | e2e-test ]

Commands:
  up             Bring up a private Arbitrum instance.
  down           Stop the Arbitrum instance.
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
