set -eo pipefail

nth_parent() {
    local n=$1
    local path=$2
    while [ $n -gt 0 ]; do
        path=$(dirname "$path");
        ((n--))
    done
    echo $path
}

get_root_dir() {
    nth_parent 3 "$(realpath "$0")"
}

ROOT="$(get_root_dir)"
RPC_FILE="${ROOT}/deployments/config/local/rpc.json"
ABI_DIR="${ROOT}/contracts/.build"

obtain_cache_dir() {
    # Create a cache dir if it does not exist
    cachedir="/tmp/beamer-$(basename -s .sh $1)-$(sha256sum $1 | cut -c-10)"
    [ -d $cachedir ] || mkdir $cachedir
    echo -n $cachedir
}

ensure_keyfile_exists() {
    # Generate a keyfile if it does not exist
    privkey=$1
    keyfile=$2
    [ -f $keyfile ] || {
        poetry run python ${ROOT}/scripts/generate_account.py --key ${privkey} --password '' ${keyfile}
    }
}

deploy_beamer() {
    keyfile=$1
    config_file=$2
    artifacts_dir=$3
    base_chain_id=$4
    pushd "${ROOT}"
    rm -rf "${output_dir}"
    poetry run beamer deploy-base \
        --keystore-file $keyfile \
        --password '' \
        --abi-dir $ABI_DIR \
        --artifacts-dir $artifacts_dir \
        --rpc-file $RPC_FILE \
        --commit-check false \
        $base_chain_id
    poetry run beamer deploy \
        --keystore-file $keyfile \
        --password '' \
        --abi-dir $ABI_DIR \
        --artifacts-dir $artifacts_dir \
        --rpc-file $RPC_FILE \
        --deploy-mintable-token \
        --commit-check false \
        $config_file
    popd
}

e2e_test_fill() {
    local artifacts_dir=$1
    local l2_rpc=$2
    local keyfile=$3
    local password=$4

    echo Performing test fill on L2...
    local output=$(poetry run python "$ROOT/scripts/e2e-test-fill.py" $artifacts_dir $ABI_DIR $l2_rpc $keyfile "$password")
    e2e_test_request_id=$(echo "$output" | awk -F: '/Request ID/ { print $2 }')
    e2e_test_l2_txhash=$(echo "$output" | awk -F: '/Fill tx hash/ { print $2 }')
    echo Request ID: $e2e_test_request_id
    echo Fill tx hash: $e2e_test_l2_txhash
}

get_relayer_binary() {
    local root=$(get_root_dir)
    local relayer=${root}/relayer/relayer-node18-linux-x64

    unamestr=$(uname)
    if [[ "$unamestr" == 'Darwin' ]]; then
       relayer=${root}/relayer/relayer-node18-macos-x64
    fi

    echo $relayer
}

e2e_test_relayer() {
    local l1_rpc=$1
    local l2_rpc=$2
    local network_config=$3
    local privkey=$4
    local txhash=$5
    local relayer=$(get_relayer_binary)
    
    echo Starting relayer...
    timeout 5m bash -c "until ${relayer} relay \
                                         --l1-rpc-url $l1_rpc \
                                         --l2-relay-to-rpc-url $l2_rpc \
                                         --l2-relay-from-rpc-url $l2_rpc \
                                         --network-to $network_config \
                                         --network-from $network_config \
                                         --wallet-private-key $privkey \
                                         --l2-transaction-hash $txhash; \
                        do sleep 1s; done"
}

e2e_test_verify() {
    local artifacts_dir=$1
    local l2_rpc=$2
    local address=$3
    local request_id=$4

    echo Verifying L1 resolution...
    poetry run python "$ROOT/scripts/e2e-test-verify.py" $artifacts_dir $ABI_DIR $l2_rpc $address $request_id
}
