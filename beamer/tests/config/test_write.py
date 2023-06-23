import logging
import tempfile
from pathlib import Path
from typing import Any

import ape
import pytest
from eth_utils import to_checksum_address

import beamer.config.commands
from beamer.config.state import ChainConfig
from beamer.deploy.artifacts import Deployment
from beamer.tests.config.util import (
    CommandFailed,
    deploy,
    read_config_state,
    run,
    write_keystore_file,
)
from beamer.tests.util import get_repo_root


def _write_config_state(rpc_file, artifact, account, current_config, desired_config):
    with tempfile.TemporaryDirectory() as tmp_path:
        current_state_path = Path(tmp_path) / "current.state"
        current_config.to_file(current_state_path)

        desired_state_path = Path(tmp_path) / "desired.state"
        desired_config.to_file(desired_state_path)

        keystore_file = Path(tmp_path) / "key.json"
        write_keystore_file(keystore_file, account.private_key, "test")

        root = get_repo_root()
        run(
            beamer.config.commands.write,
            (
                "--rpc-file",
                rpc_file,
                "--abi-dir",
                f"{root}/contracts/.build/",
                "--artifact",
                artifact,
                "--keystore-file",
                str(keystore_file),
                "--password",
                "test",
                str(current_state_path),
                str(desired_state_path),
            ),
        )


@pytest.fixture
def tmp_deployment_path(tmp_path_factory):
    return tmp_path_factory.mktemp("deployment")


@pytest.fixture
def deployment_objects(tmp_deployment_path, deployer, token):
    rpc_file, artifact = deploy(deployer, tmp_deployment_path)
    deployment = Deployment.from_file(artifact)
    assert deployment.chain is not None

    # Call updateToken so that the eventual 'config read' command can pick up the token.
    address = deployment.chain.contracts["RequestManager"].address
    request_manager: Any = ape.project.RequestManager.at(address)  # type: ignore
    request_manager.updateToken(token.address, 0, 0)

    return rpc_file, artifact, deployment


def test_config_write_request_manager(deployment_objects, deployer):
    rpc_file, artifact, deployment = deployment_objects
    current = read_config_state(rpc_file, artifact)

    desired = current.to_desired_config()
    desired.request_manager.min_fee_ppm = 77
    desired.request_manager.lp_fee_ppm = 88
    desired.request_manager.protocol_fee_ppm = 99
    desired.request_manager.chains[1] = ChainConfig(
        finality_period=123, transfer_cost=456, target_weight_ppm=789
    )
    desired.request_manager.tokens["TST"].transfer_limit = 1_000
    desired.request_manager.tokens["TST"].eth_in_token = 2_000

    lp = ape.accounts.test_accounts[0].address
    desired.request_manager.whitelist.add(lp)

    _write_config_state(rpc_file, artifact, deployer, current, desired)

    token_address = desired.token_addresses["TST"]
    address = deployment.chain.contracts["RequestManager"].address
    request_manager: Any = ape.project.RequestManager.at(address)  # type: ignore
    assert request_manager.minFeePPM() == 77
    assert request_manager.lpFeePPM() == 88
    assert request_manager.protocolFeePPM() == 99
    assert request_manager.chains(1).finalityPeriod == 123
    assert request_manager.chains(1).transferCost == 456
    assert request_manager.chains(1).targetWeightPPM == 789
    assert request_manager.tokens(token_address).transferLimit == 1_000
    assert request_manager.tokens(token_address).ethInToken == 2_000
    assert request_manager.allowedLps(lp)

    current = desired.to_config(ape.chain.blocks[-1].number)
    desired.request_manager.whitelist.remove(lp)

    _write_config_state(rpc_file, artifact, deployer, current, desired)
    assert not request_manager.allowedLps(lp)


def test_config_write_fill_manager(deployment_objects, deployer):
    rpc_file, artifact, deployment = deployment_objects
    current = read_config_state(rpc_file, artifact)

    lp = ape.accounts.test_accounts[0].address
    desired = current.to_desired_config()
    desired.fill_manager.whitelist.add(lp)

    _write_config_state(rpc_file, artifact, deployer, current, desired)

    address = deployment.chain.contracts["FillManager"].address
    fill_manager: Any = ape.project.FillManager.at(address)  # type: ignore
    assert fill_manager.allowedLps(lp)

    current = desired.to_config(ape.chain.blocks[-1].number)
    desired.fill_manager.whitelist.remove(lp)

    _write_config_state(rpc_file, artifact, deployer, current, desired)
    assert not fill_manager.allowedLps(lp)


def test_error_on_block_number_in_the_future(deployment_objects, deployer, caplog):
    caplog.set_level(logging.ERROR)
    rpc_file, artifact, _ = deployment_objects
    current = read_config_state(rpc_file, artifact)
    desired = current.to_desired_config()
    current.block *= 1_000_000

    with pytest.raises(CommandFailed):
        _write_config_state(rpc_file, artifact, deployer, current, desired)
    assert len(caplog.messages) == 1
    assert "Block number of current configuration is in the future" in caplog.messages[0]


def test_error_on_different_chain_ids(deployment_objects, deployer, caplog):
    caplog.set_level(logging.ERROR)
    rpc_file, artifact, _ = deployment_objects
    current = read_config_state(rpc_file, artifact)
    desired = current.to_desired_config()
    desired.chain_id = current.chain_id + 1

    with pytest.raises(CommandFailed):
        _write_config_state(rpc_file, artifact, deployer, current, desired)
    assert len(caplog.messages) == 1
    assert (
        "Chain ID differs between current configuration and desired configuration"
        in caplog.messages[0]
    )


def test_error_on_stale_config(deployment_objects, deployer, caplog):
    caplog.set_level(logging.ERROR)
    rpc_file, artifact, deployment = deployment_objects
    current = read_config_state(rpc_file, artifact)
    desired = current.to_desired_config()

    address = deployment.chain.contracts["RequestManager"].address
    request_manager: Any = ape.project.RequestManager.at(address)  # type: ignore

    # Call updateFees so that current becomes stale.
    request_manager.updateFees(1, 2, 3)

    with pytest.raises(CommandFailed):
        _write_config_state(rpc_file, artifact, deployer, current, desired)
    assert len(caplog.messages) == 1
    assert "Found configuration update event since start block" in caplog.messages[0]


def test_error_on_same_token_different_addresses(deployment_objects, deployer, caplog):
    caplog.set_level(logging.ERROR)
    rpc_file, artifact, _ = deployment_objects
    current = read_config_state(rpc_file, artifact)
    desired = current.to_desired_config()
    desired.token_addresses["TST"] = to_checksum_address(
        "0x" + current.token_addresses["TST"][-1:1:-1]
    )

    with pytest.raises(CommandFailed):
        _write_config_state(rpc_file, artifact, deployer, current, desired)
    assert len(caplog.messages) == 1
    assert "Token symbol refers to different addresses" in caplog.messages[0]


def test_no_update_if_same_config(deployment_objects, deployer):
    rpc_file, artifact, _ = deployment_objects
    current = read_config_state(rpc_file, artifact)
    desired = current.to_desired_config()

    block_number = ape.chain.blocks[-1].number
    _write_config_state(rpc_file, artifact, deployer, current, desired)
    assert ape.chain.blocks[-1].number == block_number
