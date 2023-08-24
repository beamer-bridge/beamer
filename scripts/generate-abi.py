import json
import tempfile
from pathlib import Path
from typing import Generator
import click
from psutil import Popen
from beamer.artifacts import Deployment


_COMPILE_COMMAND = """
git clone --no-checkout git@github.com:beamer-bridge/beamer.git {beamer_path} &&
cd {beamer_path} &&
git checkout {commit_id} &&
ape compile
"""


def _iter_contracts_commits(deployment: Deployment) -> Generator[tuple[str, str], None, None]:
    for name, info in deployment.base.contracts.items():
        yield name, info.beamer_commit

    if deployment.chain is not None:
        for name, info in deployment.chain.contracts.items():
            yield name, info.beamer_commit


def _get_contract_commit_ids(artifacts_dir: Path) -> dict[str, set[str]]:
    contract_commits: dict[str, set[str]] = {}
    for path in artifacts_dir.glob("*.deployment.json"):
        deployment = Deployment.from_file(path)
        for contract_name, commit in _iter_contracts_commits(deployment):
            if contract_name not in contract_commits:
                contract_commits[contract_name] = set()
            contract_commits[contract_name].add(commit)
    return contract_commits


def _compile_abis(commit_id: str, beamer_path: str) -> None:
    command = _COMPILE_COMMAND.format(beamer_path=beamer_path, commit_id=commit_id).replace(
        "\n", ""
    )
    Popen(command, shell=True).wait()


def _generate_abis(contract_commits: dict[str, set[str]]) -> dict[str, str]:
    generated_abis: dict[str, str] = {}
    processed_commit_ids = set()

    for commit_ids in contract_commits.values():
        for commit_id in commit_ids:
            if commit_id in processed_commit_ids:
                continue
            with tempfile.TemporaryDirectory() as tmpdirname:
                _compile_abis(commit_id, tmpdirname)
                for contract_name in contract_commits:
                    if commit_id not in contract_commits[contract_name]:
                        continue
                    abi_path = Path(tmpdirname) / f"contracts/.build/{contract_name}.json"
                    with open(abi_path, "r") as fp:
                        contract_abi = fp.read()
                    abi = generated_abis.get(contract_name)
                    if (
                        abi is not None
                        and json.loads(contract_abi)["abi"] != json.loads(abi)["abi"]
                    ):
                        raise ValueError(f"Different ABI found for {contract_name}")
                    generated_abis[contract_name] = contract_abi
            processed_commit_ids.add(commit_id)
    return generated_abis


@click.command()
@click.argument("artifacts_dir", type=click.Path(file_okay=False, dir_okay=True, path_type=Path))
@click.argument("output_path", type=click.Path(file_okay=False, dir_okay=True, path_type=Path))
@click.option("--only-abi", is_flag=True)
def main(artifacts_dir: Path, output_path: Path, only_abi: bool) -> None:
    contract_commits = _get_contract_commit_ids(artifacts_dir)
    generated_abis = _generate_abis(contract_commits)
    output_path.mkdir(exist_ok=True, parents=True)
    for contract_name, abi in generated_abis.items():
        abi_path = output_path / f"{contract_name}.json"
        abi_data = json.loads(abi)
        abi_data.pop("ast", None)
        if only_abi:
            abi_data = abi_data["abi"]
            abi_data = {"abi": abi_data}
        with open(abi_path, "w") as fp:
            json.dump(abi_data, fp)


if __name__ == "__main__":
    main()
