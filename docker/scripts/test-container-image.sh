#!/usr/bin/env bash
. "$(realpath $(dirname $0))/common.sh"

ROOT="$(get_root_dir)"

CACHE_DIR=$(obtain_cache_dir "$0")
DEPLOYMENT_DIR="${CACHE_DIR}/deployment"
DEPLOYMENT_CONFIG_FILE="${ROOT}/scripts/deployment/ethereum-local.json"

# Generate deployer's key.
KEYFILE=$(mktemp -p ${CACHE_DIR})
ADDRESS=$(python ${ROOT}/scripts/generate_account.py --password '' ${KEYFILE})
PRIVKEY=$(python ${ROOT}/scripts/dump-private-key.py ${KEYFILE})
echo Beamer deployer\'s address and keyfile: ${ADDRESS} ${KEYFILE}

echo -n Starting ganache:
name=$(npx ganache --chain.vmErrorsOnRPCResponse true  --hardfork istanbul --detach \
                   --wallet.accounts $PRIVKEY,0x3635C9ADC5DEA00000)
echo $name

function cleanup {
    echo Stopping ganache: $name
    npx ganache instances stop $name
}

trap cleanup EXIT

echo Deploying Beamer...
mkdir -p ${CACHE_DIR}/deployment
deploy_beamer ${KEYFILE} ${DEPLOYMENT_CONFIG_FILE} ${DEPLOYMENT_DIR}

echo Whitelisting deployer...
python ${ROOT}/scripts/call_contracts.py --keystore-file ${KEYFILE} \
                                         --password '' \
                                         --eth-rpc http://localhost:8545 \
                                         --deployment-dir ${DEPLOYMENT_DIR} \
                                         whitelist ${ADDRESS}

cat <<EOF > ${CACHE_DIR}/agent.conf
log-level = "debug"
deployment-dir = "${DEPLOYMENT_DIR}"
poll-period = 0.1
confirmation-blocks = 0

[account]
path = "${KEYFILE}"
password = ""

[base-chain]
rpc-url = "http://localhost:8545"

[chains.foo]
rpc-url = "http://localhost:8545"

[chains.bar]
rpc-url = "http://localhost:8545"
EOF

echo Starting agent...
container_id=$(docker run --detach --rm --net=host -v ${CACHE_DIR}:${CACHE_DIR} $1 \
                          agent --config ${CACHE_DIR}/agent.conf)

let n=30
echo Waiting $n seconds for the sync to finish...
while [[ $n -gt 0 ]]; do
    echo $n
    if docker logs $container_id | grep 'Sync done' > /dev/null; then
        docker kill --signal INT $container_id > /dev/null
        echo Test ok.
        exit 0
    fi
    sleep 1
    ((n--))
done

echo Test failed.
docker logs $container_id
exit 1
