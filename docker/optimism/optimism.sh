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
CONTRACT_ADDRESSES=${OPTIMISM}/.devnet/addresses.json

ensure_keyfile_exists ${PRIVKEY} ${KEYFILE}
echo Beamer deployer\'s keyfile: ${KEYFILE}

configure_repo() {
    repo="https://github.com/ethereum-optimism/optimism.git"
    commit_id="6a474e36aba94f15ed90f71d1920e4b1d34513ab"
    git clone --no-checkout ${repo} ${OPTIMISM}
    cd ${OPTIMISM}
    git checkout ${commit_id}
}

down() {
    echo "Shutting down the end-to-end environment"
    cd ${OPTIMISM}
    make devnet-down
    make devnet-clean
    cd ${ROOT}
}

up() {
    echo "Starting the end-to-end environment"
    source ~/.bashrc
    if [ ! -d ${OPTIMISM} ]; then
        configure_repo
    fi
    cd ${OPTIMISM}
    echo "v16.20.0" > .nvmrc
    nvm use
    npm install --global yarn
    yarn install
    yarn build
    make devnet-up-deploy
    cd ${ROOT}
}

create_deployment_config_file() {
    ADDRESS=$(addresses | jq '.["Proxy__OVM_L1CrossDomainMessenger"]')
    sed "s/\${l1_messenger_args}/${ADDRESS}/" \
        ${ROOT}/scripts/deployment/optimism-local-template.json \
        > ${DEPLOYMENT_CONFIG_FILE}
}

e2e_test() {
    l2_rpc=http://localhost:9545
    password=""
    
    e2e_test_fill ${DEPLOYMENT_DIR} ${KEYFILE} "${password}" $l2_rpc
    echo Sending Proof
    e2e_test_op_proof http://localhost:8545 $l2_rpc $CONTRACT_ADDRESSES $PRIVKEY $e2e_test_l2_txhash
    sleep 20
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
    cat ${CONTRACT_ADDRESSES}
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
