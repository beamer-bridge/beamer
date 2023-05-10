from pathlib import Path

import ape
import click
import structlog
from eth_utils import to_checksum_address

import beamer.deploy.artifacts
import beamer.deploy.config
from beamer.typing import URL, ChainId

log = structlog.get_logger(__name__)


def _get_contract_info(artifacts_dir: Path) -> dict[ChainId, dict[str, dict[str, str]]]:
    contract_info: dict[ChainId, dict[str, dict[str, str]]] = {}
    for file_path in artifacts_dir.glob("*.deployment.json"):
        deployment = beamer.deploy.artifacts.Deployment.from_file(file_path)
        if file_path.stem == "base.deployment":
            ecosystem = "ethereum"
            chain_id = deployment.base.chain_id
            contracts = deployment.base.contracts
        else:
            assert deployment.chain is not None
            ecosystem_info = file_path.stem.split(".")[0]
            _, ecosystem = ecosystem_info.split("-", 1)
            chain_id = deployment.chain.chain_id
            contracts = deployment.chain.contracts
        if chain_id not in contract_info:
            contract_info[chain_id] = {}
        for contract_name, contract in contracts.items():
            contract_info[chain_id][contract_name] = {
                "address": contract.address,
                "ecosystem": ecosystem,
                "network": file_path.parent.stem,
            }

    return contract_info


def _verify_contract(
    contract_name: str, contract_info: dict[str, str], rpc_url: URL, chain_id: ChainId
) -> None:
    try:
        ape_ecosystem = getattr(ape.networks, contract_info["ecosystem"])
        ape_network = getattr(ape_ecosystem, contract_info["network"])
        with ape_network.use_provider(rpc_url):
            etherscan = ape.networks.provider.network.explorer
            assert etherscan is not None
            getattr(ape.project, contract_name).at(contract_info["address"])
            log.info(
                "Verifying contract",
                contract=contract_name,
                chain_id=chain_id,
                address=contract_info["address"],
            )
            etherscan.publish_contract(to_checksum_address(contract_info["address"]))
    except Exception as err:
        log.error("Failed", err=err)


@click.command()
@click.argument("artifacts_dir", type=click.Path(file_okay=False, dir_okay=True, path_type=Path))
@click.argument("rpc_file", type=click.Path(file_okay=True, dir_okay=False, path_type=Path))
def main(artifacts_dir: Path, rpc_file: Path) -> None:
    contract_info = _get_contract_info(artifacts_dir)
    rpc_info = beamer.deploy.config.load_rpc_info(rpc_file)
    for chain_id, contracts in contract_info.items():
        rpc_url = rpc_info[chain_id]
        for contract_name, contract in contracts.items():
            _verify_contract(contract_name, contract, rpc_url, chain_id)


if __name__ == "__main__":
    main()
