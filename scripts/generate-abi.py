import json
import tempfile
from pathlib import Path

import click
from psutil import Popen

_COMPILE_COMMAND = """
git clone --no-checkout git@github.com:beamer-bridge/beamer.git {beamer_path} &&
cd {beamer_path} &&
git checkout {commit_id} &&
ape compile
"""


def _get_contract_commit_ids(deployment_path: Path) -> dict[str, set[str]]:
    contract_commits: dict[str, set[str]] = {}
    for file_path in deployment_path.glob("*.deployment.json"):
        with open(file_path, "r") as fp:
            data = json.load(fp)
        data.pop("deployer")
        for contract_name, contract_info in data.items():
            if contract_name not in contract_commits:
                contract_commits[contract_name] = set()
            contract_commits[contract_name].add(contract_info["beamer_commit"])
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
                    abi_path = Path(tmpdirname) / f"contracts/.build/{contract_name}.json"
                    with open(abi_path, "r") as fp:
                        contract_abi = fp.read()
                    abi = generated_abis.get(contract_name)
                    if abi is not None and contract_abi != abi:
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
        if only_abi:
            abi = json.loads(abi)["abi"]
            abi = json.dumps({"abi": abi})
        with open(abi_path, "w") as fp:
            fp.write(abi)


if __name__ == "__main__":
    main()
