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
    root=$(get_root_dir)
    [ -f $keyfile ] || {
        poetry run python ${root}/scripts/generate_account.py --key ${privkey} --password '' ${keyfile}
    }
}

deploy_beamer() {
    root=$(get_root_dir)
    keyfile=$1
    config_file=$2
    output_dir=$3
    pushd "${root}"
    rm -rf "${output_dir}" &&
    poetry run python scripts/deployment/main.py \
        --keystore-file ${keyfile} \
        --password '' \
        --config-file "${config_file}" \
        --output-dir "${output_dir}" \
        --allow-same-chain \
        --deploy-mintable-token
    popd
}

e2e_test_fill() {
    local root="$(get_root_dir)"
    local deployment_dir=$1
    local keyfile=$2
    local password=$3
    local l2_rpc=$4

    echo Performing test fill on L2...
    local output=$(poetry run python "$root/scripts/e2e-test-fill.py" $deployment_dir $keyfile "$password" $l2_rpc)
    e2e_test_request_id=$(echo "$output" | awk -F: '/Request ID/ { print $2 }')
    e2e_test_l2_txhash=$(echo "$output" | awk -F: '/Fill tx hash/ { print $2 }')
    echo Request ID: $e2e_test_request_id
    echo Fill tx hash: $e2e_test_l2_txhash
}

e2e_test_verify() {
    local root="$(get_root_dir)"
    local deployment_dir=$1
    local l2_rpc=$2
    local address=$3
    local request_id=$4

    echo Verifying L1 resolution...
    poetry run python "$root/scripts/e2e-test-verify.py" $deployment_dir $l2_rpc $address $request_id
}
