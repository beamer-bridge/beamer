import json
import logging
import subprocess
from typing import Any

import ape
import pytest
from apischema.validation.mock import NonTrivialDependency

import beamer.config.commands
from beamer.artifacts import Deployment
from beamer.config.state import Configuration
from beamer.tests.config.util import CommandFailed, deploy, read_config_state, run
from beamer.tests.util import get_repo_root


def test_config_read_request_manager(tmp_path, token, deployer):
    rpc_file, artifact = deploy(deployer, tmp_path)
    deployment = Deployment.from_file(artifact)
    assert deployment.chain is not None

    config = read_config_state(rpc_file, artifact)
    assert config.request_manager.min_fee_ppm == 0
    assert config.request_manager.lp_fee_ppm == 0
    assert config.request_manager.protocol_fee_ppm == 0
    assert not config.request_manager.chains
    assert not config.request_manager.tokens
    assert not config.request_manager.whitelist
    address = deployment.chain.contracts["RequestManager"].address
    request_manager: Any = ape.project.RequestManager.at(address)  # type: ignore

    # check fee update
    request_manager.updateFees(1, 2, 3)

    config = read_config_state(rpc_file, artifact)
    assert config.request_manager.min_fee_ppm == 1
    assert config.request_manager.lp_fee_ppm == 2
    assert config.request_manager.protocol_fee_ppm == 3

    old_block = config.block

    # check token update
    request_manager.updateToken(token.address, 4, 5)

    config = read_config_state(rpc_file, artifact)
    assert config.block > old_block
    assert len(config.request_manager.tokens) == 1
    symbol = token.symbol()
    token_config = config.request_manager.tokens[symbol]
    assert token_config.transfer_limit == 4
    assert token_config.eth_in_token == 5
    assert config.token_addresses == {symbol: token.address}

    # check chain update
    request_manager.updateChain(123, 6, 7, 8)

    config = read_config_state(rpc_file, artifact)
    assert len(config.request_manager.chains) == 1
    chain_config = config.request_manager.chains[123]
    assert chain_config.finality_period == 6
    assert chain_config.transfer_cost == 7
    assert chain_config.target_weight_ppm == 8

    # check LP addition
    lp = ape.accounts.test_accounts[0].address
    request_manager.addAllowedLp(lp)

    config = read_config_state(rpc_file, artifact)
    assert config.request_manager.whitelist == [lp]

    # check LP removal
    request_manager.removeAllowedLp(lp)

    config = read_config_state(rpc_file, artifact)
    assert not config.request_manager.whitelist


def test_config_read_fill_manager(tmp_path, deployer):
    rpc_file, artifact = deploy(deployer, tmp_path)
    deployment = Deployment.from_file(artifact)
    assert deployment.chain is not None

    config = read_config_state(rpc_file, artifact)
    assert not config.fill_manager.whitelist
    address = deployment.chain.contracts["FillManager"].address
    fill_manager: Any = ape.project.FillManager.at(address)  # type: ignore

    # check LP addition
    lp = ape.accounts.test_accounts[0].address
    fill_manager.addAllowedLp(lp, sender=deployer.address)

    config = read_config_state(rpc_file, artifact)
    assert config.fill_manager.whitelist == [lp]

    # check LP removal
    fill_manager.removeAllowedLp(lp, sender=deployer.address)

    config = read_config_state(rpc_file, artifact)
    assert not config.fill_manager.whitelist


def test_config_read_checksum_mismatch(tmp_path, deployer):
    rpc_file, artifact = deploy(deployer, tmp_path)
    deployment = Deployment.from_file(artifact)
    assert deployment.chain is not None

    address = deployment.chain.contracts["RequestManager"].address
    request_manager: Any = ape.project.RequestManager.at(address)  # type: ignore

    request_manager.updateFees(1, 2, 3)

    config = read_config_state(rpc_file, artifact)
    path = tmp_path / "temp.state"
    config.to_file(path)

    # modify the data so the checksum does not match anymore
    data = json.loads(path.read_text())
    data["RequestManager"]["min_lp_fee"] = 9
    path.write_text(json.dumps(data))

    # TODO: due to a presumed bug in apischema, we cannot do
    #
    #  match = r"checksum mismatch: [0-9a-f]+ \(expected [0-9a-f]+\)"
    #  with pytest.raises(ValidationError, match=match):
    #
    # because apischema will raise NonTrivialDependency.
    with pytest.raises(NonTrivialDependency):
        Configuration.from_file(path)


_DATA = """{
    "checksum": "a5aaf72bfd4d763fe37ac8f3adab2bc525e68380e92e527df0be67bbb11fc0e3",
    "block": 1592695,
    "chain_id": 1101,
    "token_addresses": {},
    "RequestManager": {
        "min_fee_ppm": 0,
        "lp_fee_ppm": 0,
        "protocol_fee_ppm": 0,
        "chains": {},
        "tokens": {},
        "whitelist": []
    },
    "FillManager": {
        "whitelist": []
    }
}"""


def test_config_checksum_can_be_computed_externally(tmp_path):
    path = tmp_path / "dummy.state"
    path.write_text(_DATA)
    output = subprocess.check_output(f"grep -v checksum {path} | sha256sum", shell=True)
    checksum = output.decode().split(" ", 1)[0]
    config = Configuration.from_file(path)
    assert config.compute_checksum() == checksum


def test_error_on_different_chain_ids(tmp_path, deployer, caplog):
    caplog.set_level(logging.ERROR)
    rpc_file, artifact = deploy(deployer, tmp_path)

    path = tmp_path / "dummy.state"
    path.write_text(_DATA)
    root = get_repo_root()
    with pytest.raises(CommandFailed):
        run(
            beamer.config.commands.read,
            (
                "--rpc-file",
                rpc_file,
                "--abi-dir",
                f"{root}/contracts/.build/",
                "--artifact",
                artifact,
                str(path),
            ),
        )
    assert len(caplog.messages) == 1
    assert "Configuration chain ID differs from the deployment chain ID" in caplog.messages[0]


def test_config_read_no_updates_found(tmp_path, deployer, caplog):
    caplog.set_level(logging.INFO)
    rpc_file, artifact = deploy(deployer, tmp_path)

    config = read_config_state(rpc_file, artifact)
    path = tmp_path / "temp.state"
    config.to_file(path)

    root = get_repo_root()
    caplog.clear()
    ape.chain.mine()
    run(
        beamer.config.commands.read,
        (
            "--rpc-file",
            rpc_file,
            "--abi-dir",
            f"{root}/contracts/.build/",
            "--artifact",
            artifact,
            str(path),
        ),
    )
    assert "No configuration updates found" in caplog.messages[-2]

    # Make sure that the block number has been updated.
    config_new = Configuration.from_file(path)
    assert config_new.block > config.block
    assert config_new.block == ape.chain.blocks.height
