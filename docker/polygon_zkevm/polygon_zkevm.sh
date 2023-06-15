#!/usr/bin/env bash
. "$(realpath $(dirname $0))/../scripts/common.sh"

# Deployer's address & private key.
ADDRESS=0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266
PRIVKEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

CACHE_DIR=$(obtain_cache_dir $0)
ARTIFACTS_DIR="${CACHE_DIR}/deployments/artifacts/local"

POLYGON_ZKEVM="${CACHE_DIR}/polygon_zkevm"
DEPLOYMENT_CONFIG_FILE="${CACHE_DIR}/1001-polygon-zkevm.json"
KEYFILE="${CACHE_DIR}/${ADDRESS}.json"

ensure_keyfile_exists ${PRIVKEY} ${KEYFILE}
echo Beamer deployer\'s keyfile: ${KEYFILE}

down() {
    echo "Shutting down the end-to-end environment"
    if [ ! -d ${POLYGON_ZKEVM} ]; then
        configure_repo
    fi
    make -C ${POLYGON_ZKEVM} stop
}

configure_repo() {
    repo="https://github.com/0xPolygonHermez/zkevm-bridge-service.git"
    commit_id="09e0247b335a19a5e16945e8e1e805e410e41ca3"
    git init ${POLYGON_ZKEVM}
    cd ${POLYGON_ZKEVM}
    git fetch --depth 1 ${repo} ${commit_id}
    git checkout ${commit_id}
}

create_deployment_config_file () {
    if [ ! -d ${POLYGON_ZKEVM} ]; then
        configure_repo
    fi
    address=$(bridge_address)
    sed "s/\"\${native_bridge}\"/${address}/" \
    ${ROOT}/deployments/config/local/1001-polygon-zkevm.json \
    > ${DEPLOYMENT_CONFIG_FILE}
    cd ${ROOT}
}

bridge_address() {
    if [ ! -d ${POLYGON_ZKEVM} ]; then
        configure_repo
    fi
    config_file=${POLYGON_ZKEVM}/test/config/node/genesis.local.json
    jq ".genesis[3].address" ${config_file}
}

up() {
    if [ ! -d ${POLYGON_ZKEVM} ]; then
        configure_repo
        make -C ${POLYGON_ZKEVM} build-docker
    fi

    echo "Starting the end-to-end environment"
    make -C ${POLYGON_ZKEVM} run
}

e2e_test() {
    l2_rpc=http://localhost:8123
    password=""

    network_file="${CACHE_DIR}/network.json"
    echo Copying contract addresses to $network_file
    address=$(bridge_address)
    cat <<EOF > $network_file
    {
        "l1": {
            "PolygonZKEvmBridge": ${address}
        },
        "l2": {
            "PolygonZKEvmBridge": ${address}
        },
        "bridgeServiceUrl": "http://localhost:8080"
    }
EOF
    e2e_test_fill $ARTIFACTS_DIR $l2_rpc $KEYFILE "${password}"
    e2e_test_relayer http://localhost:8545 $l2_rpc $network_file $PRIVKEY $e2e_test_l2_txhash
    e2e_test_verify $ARTIFACTS_DIR $l2_rpc $ADDRESS $e2e_test_request_id
}

usage() {
    cat <<EOF
$0  [up | down | deploy-beamer | e2e-test ]

Commands:
  up             Bring up a private Polygon ZkEVM instance.
  down           Stop the Polygon ZkEVM instance.
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
