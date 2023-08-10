#!/usr/bin/env bash
. "$(realpath $(dirname $0))/../scripts/common.sh"

# Deployer's address & private key.
ADDRESS=0x1CEE82EEd89Bd5Be5bf2507a92a755dcF1D8e8dc
PRIVKEY=0x3ff6c8dfd3ab60a14f2a2d4650387f71fe736b519d990073e650092faaa621fa

CACHE_DIR=$(obtain_cache_dir "$0")
NITRO="${CACHE_DIR}/nitro"
ARTIFACTS_DIR="${CACHE_DIR}/deployments/artifacts/local"
DEPLOYMENT_CONFIG_FILE="${CACHE_DIR}/412346-arbitrum.json"
KEYFILE="${CACHE_DIR}/${ADDRESS}.json"

ensure_keyfile_exists ${PRIVKEY} ${KEYFILE}
echo Beamer deployer\'s keyfile: ${KEYFILE}

TEST_NODE_SCRIPT="${NITRO}/test-node-patched.bash"

patch_test_node_script() {
    # We need to patch the test-node.bash script so that it
    # 1) does not ask for confirmation when given the --init option
    # 2) uses the correct working directory
    [ -f ${TEST_NODE_SCRIPT} ] || {
        sed -E "s#^(run=true)\$#\1\nforce_init=true#;
                s#^mydir=\`dirname .0\`#mydir=${NITRO}#" \
            ${NITRO}/test-node.bash > ${TEST_NODE_SCRIPT}

        # fix for flaky test https://github.com/OffchainLabs/nitro/issues/1706
        sed -i'' -e 's/NITRO_NODE_VERSION=offchainlabs\/nitro-node:v2\.1\.0-beta\.1-03a2aea-dev/NITRO_NODE_VERSION=offchainlabs\/nitro-node:v2.1.0-beta.4-837e45e-dev/' "${TEST_NODE_SCRIPT}"

        chmod +x ${TEST_NODE_SCRIPT}
    }
}

configure_repo() {
    repo="https://github.com/OffchainLabs/nitro.git"
    commit_id="0b32740ddd245ff0e52b1fd1a0372b90195f6a0c"
    git init ${NITRO}
    cd ${NITRO}
    git fetch --depth 1 ${repo} ${commit_id} 
    git checkout ${commit_id}
    git submodule update --init blockscout
}

if [ ! -d ${NITRO} ]; then
    configure_repo
fi
patch_test_node_script

down() {
    echo "Shutting down the end-to-end environment"

    # First stop the scripts containers, as docker compose down will fail if they are running
    image_id=$(docker ps --filter "ancestor=nitro-testnode-scripts" --format "{{.ID}}")
    if [[ ! -z $image_id ]]; then
        docker stop $image_id
    fi

    docker-compose -f ${NITRO}/docker-compose.yaml down
}

fund_account() {
    ${TEST_NODE_SCRIPT} script send-l1 --ethamount 100 --to address_${ADDRESS}
    ${TEST_NODE_SCRIPT} script send-l2 --ethamount 100 --to address_${ADDRESS}
    # Wait a bit for the transactions to go through
    sleep 3
}

wait_for_sequencer() {
    local RETRIES=180
    local i=0
    until docker logs nitro-sequencer-1 2>&1 | grep "HTTP server started" > /dev/null;
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

up() {
    echo Starting the end-to-end environment
    ${TEST_NODE_SCRIPT} --init --detach
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
        ${ROOT}/deployments/config/local/412346-arbitrum.json \
        > ${DEPLOYMENT_CONFIG_FILE}
}

e2e_test() {
    image_id=$(docker ps --filter "ancestor=nitro-testnode-scripts" --format "{{.ID}}")
    if [[ ! -z $image_id ]]; then
        docker stop $image_id
    fi
    l2_rpc=http://0.0.0.0:8547
    password=""
    l1_messenger=$(jq -r '.base.ArbitrumL1Messenger.address' ${ARTIFACTS_DIR}/412346-arbitrum.deployment.json)
    resolver=$(jq -r '.base.Resolver.address' ${ARTIFACTS_DIR}/base.deployment.json)

    network_config="${CACHE_DIR}/localnetwork.json"
    echo Copying network config to $network_config
    docker-compose -f ${NITRO}/docker-compose.yaml run --entrypoint sh testnode-tokenbridge \
                   -c "cat localNetwork.json" > $network_config

    e2e_test_fill $ARTIFACTS_DIR $l2_rpc $KEYFILE "${password}"

    export ARBITRUM_L1_MESSENGER=$l1_messenger
    export RESOLVER=$resolver

    e2e_test_relayer http://0.0.0.0:8545 $l2_rpc $network_config $KEYFILE $e2e_test_l2_txhash
    e2e_test_verify $ARTIFACTS_DIR $l2_rpc $ADDRESS $e2e_test_request_id
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
        deploy_beamer ${KEYFILE} ${DEPLOYMENT_CONFIG_FILE} ${ARTIFACTS_DIR} 1337
        ;;

    e2e-test)
        e2e_test
        ;;

    *)
        usage
        exit 1
        ;;
esac
