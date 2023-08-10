#!/usr/bin/env bash
. "$(realpath $(dirname $0))/../scripts/common.sh"

# Deployer's address & private key.
# https://github.com/0xPolygonHermez/zkevm-node/blob/develop/docs/running_local.md
# This address has funds on L1, but not on L2
ADDRESS=0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
PRIVKEY=0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a

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
    commit_id="59c1ba75fa19cf1156762a8c5ffa7f8fd272c60a"
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

fund_account() {
  echo "Fund account"
  DEPOSIT_FILE="${POLYGON_ZKEVM}/test/scripts/deposit/main.go"
  # Replace the hardcoded address and private key with our L1 account
  sed -i'' -e "s/0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266/$ADDRESS/" "${DEPOSIT_FILE}"
  sed -i'' -e "s/0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80/$PRIVKEY/" "${DEPOSIT_FILE}"

  cd ${POLYGON_ZKEVM}
  go run test/scripts/deposit/main.go
  cd ${ROOT}

  # Wait a bit for the transactions to go through
  sleep 3
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

    fund_account
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
    e2e_test_relayer http://localhost:8545 $l2_rpc $network_file $KEYFILE $e2e_test_l2_txhash
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
