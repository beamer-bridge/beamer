import json

from typing import Any

import ape
import pytest
from apischema.validation.mock import NonTrivialDependency

from beamer.config.state import Configuration
from beamer.deploy.artifacts import Deployment
from beamer.tests.config.util import deploy, read_config_state


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
