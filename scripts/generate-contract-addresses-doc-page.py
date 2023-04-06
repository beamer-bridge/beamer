import json
import sys
import textwrap
from typing import Generator, Iterable

_NAMES = {
    1: "Ethereum",
    10: "Optimism",
    288: "Boba",
    42161: "Arbitrum",
}

_EXPLORERS = {
    1: "https://etherscan.io/address/{address}",
    10: "https://optimistic.etherscan.io/address/{address}",
    288: "https://bobascan.com/address/{address}",
    42161: "https://arbiscan.io/address/{address}",
}


def main() -> None:
    deployment = json.loads(sys.stdin.read())
    print(
        textwrap.dedent(
            """\
    Beamer contract addresses
    =========================
    """
        )
    )

    for chain_id, contracts in deployment["chains"].items():
        name = _NAMES[int(chain_id)]
        explorer = _EXPLORERS[int(chain_id)]
        if name == "Ethereum":
            base_contracts = deployment["base_chain"]
            contracts.update(base_contracts)
        _generate_section(name, explorer, contracts)


def _generate_section(section_name: str, explorer: str, contracts: dict) -> None:
    def rows() -> Generator[tuple[str, str], None, None]:
        yield "Contract", "Address"
        for name, contract in contracts.items():
            address = contract["address"]
            url = explorer.format(address=address)
            yield name, f"`{address} <{url}>`_"

    section_marker = "-" * len(section_name)
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
