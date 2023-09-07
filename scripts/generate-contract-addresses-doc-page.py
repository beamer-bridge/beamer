import sys
import textwrap
from pathlib import Path
from typing import Generator, Iterable

from eth_typing import ChecksumAddress

from beamer.artifacts import DeployedContractInfo, Deployment
from beamer.typing import ChainId

_NAMES = {
    1: "Ethereum",
    10: "Optimism",
    288: "Boba",
    42161: "Arbitrum",
    1101: "Polygon ZkEVM",
    8453: "Base",
    424: "Public Goods Network",
}

_EXPLORERS = {
    1: "https://etherscan.io/address/{address}",
    10: "https://optimistic.etherscan.io/address/{address}",
    288: "https://bobascan.com/address/{address}",
    42161: "https://arbiscan.io/address/{address}",
    1101: "https://zkevm.polygonscan.com/address/{address}",
    8453: "https://basescan.org/address/{address}",
    424: "https://explorer.publicgoods.network/{address}",
}

_CONTRACT_INFO: dict[ChainId, dict[tuple[str, ChainId], ChecksumAddress]] = {}


def process_contracts_for_chain(
    chain_id: ChainId, contracts: dict[str, DeployedContractInfo]
) -> None:
    if chain_id not in _CONTRACT_INFO:
        _CONTRACT_INFO[chain_id] = {}
    for contract_name, contract in contracts.items():
        _CONTRACT_INFO[chain_id][(contract_name, chain_id)] = contract.address


def main() -> None:
    artifacts_dir = Path(sys.argv[1])
    print(
        textwrap.dedent(
            """\
    Beamer contract addresses
    -------------------------
    """
        )
    )

    for artifact_path in artifacts_dir.glob("*.deployment.json"):
        deployment = Deployment.from_file(artifact_path)
        base_chain_id = deployment.base.chain_id
        process_contracts_for_chain(base_chain_id, deployment.base.contracts)

        if deployment.chain is None:
            continue

        chain_id = deployment.chain.chain_id
        process_contracts_for_chain(chain_id, deployment.chain.contracts)

    for chain_id, contracts in _CONTRACT_INFO.items():
        explorer = _EXPLORERS[chain_id]
        name = _NAMES[chain_id]
        _generate_section(name, explorer, contracts)


def _generate_section(section_name: str, explorer: str, contracts: dict) -> None:
    def rows() -> Generator[tuple[str, str], None, None]:
        yield "Contract", "Address"
        for name, address in contracts.items():
            url = explorer.format(address=address)
            yield name[0], f"`{address} <{url}>`__"

    section_marker = "~" * len(section_name)
    print(f"\n{section_name}")
    print(f"{section_marker}\n")
    _generate_table(rows())


def _generate_table(rows: Iterable[tuple]) -> None:
    print(
        textwrap.dedent(
            """\
      .. list-table::
         :header-rows: 1
    """
        )
    )

    for row in rows:
        columns = iter(row)
        print(f"""   * - {next(columns)}""")
        print("".join(f"""     - {col}\n""" for col in columns))


if __name__ == "__main__":
    main()
