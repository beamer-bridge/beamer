import subprocess
from pathlib import Path
from typing import Any

import click
import structlog

import beamer.contracts
import beamer.deploy.artifacts
import beamer.util
from beamer.deploy.util import deploy_beamer, deploy_contract
from beamer.typing import ChainId
from beamer.util import get_commit_id, make_web3

log = structlog.get_logger(__name__)


def _ensure_commit_is_on_remote() -> None:
    commit_id = get_commit_id()
    output = subprocess.check_output(["git", "branch", "-r", "--contains", commit_id])
    branches = map(str.strip, output.decode("utf-8").split("\n"))
    if not any(
        branch == "origin/main" or branch.startswith("origin/release/") for branch in branches
    ):
        raise RuntimeError("could not find commit %s on the remote" % commit_id)


class _ChainIdParam(click.ParamType):
    def convert(self, value: Any, param: click.Parameter | None, ctx: click.Context | None) -> Any:
        try:
            chain_id = ChainId(int(value))
            if chain_id <= 0:
                raise ValueError("chain ID must be positive")
        except ValueError as exc:
            self.fail(str(exc), param, ctx)
        else:
            return chain_id


@click.command("deploy-base")
@click.option(
    "--rpc-file",
    type=click.Path(exists=True, file_okay=True, dir_okay=False, path_type=Path),
    required=True,
    metavar="PATH",
    help="Path to the RPC config file.",
)
@click.option(
    "--keystore-file",
    type=click.Path(exists=True, file_okay=True, dir_okay=False, path_type=Path),
    required=True,
    metavar="PATH",
    help="Path to the keystore file.",
)
@click.password_option(
    "--password",
    type=str,
    default="",
    prompt=False,
    help="The password needed to unlock the keystore file.",
)
@click.option(
    "--artifacts-dir",
    type=click.Path(file_okay=False, dir_okay=True, path_type=Path),
    required=True,
    metavar="DIR",
    help="The directory to store contract deployment artifacts in.",
)
@click.option(
    "--commit-check",
    type=bool,
    default=True,
    show_default=True,
    help="Whether to check for commit on the remote.",
)
@click.argument("chain_id", type=_ChainIdParam())
def deploy_base(
    rpc_file: Path,
    keystore_file: Path,
    password: str,
    artifacts_dir: Path,
    chain_id: ChainId,
    commit_check: bool,
) -> None:
    """Deploy resolver on the base chain."""
    beamer.util.setup_logging(log_level="DEBUG", log_json=False)
    if commit_check:
        _ensure_commit_is_on_remote()

    artifacts_dir.mkdir(parents=True, exist_ok=True)

    rpc_info = beamer.util.load_rpc_info(rpc_file)
    account = beamer.util.account_from_keyfile(keystore_file, password)
    log.info("Loaded keystore file", address=account.address)

    url = rpc_info[chain_id]
    w3 = make_web3(url, account)
    assert w3.eth.chain_id == chain_id
    log.info("Connected to RPC", url=url)

    resolver = deploy_contract(w3, "Resolver")
    path = artifacts_dir / "base.deployment.json"
    beamer.deploy.artifacts.generate(path, account.address, (resolver,))
    log.info("Generated artifact", path=str(path))


@click.command("deploy")
@click.option(
    "--rpc-file",
    type=click.Path(exists=True, file_okay=True, dir_okay=False, path_type=Path),
    required=True,
    metavar="PATH",
    help="Path to the RPC config file.",
)
@click.option(
    "--keystore-file",
    type=click.Path(exists=True, file_okay=True, dir_okay=False, path_type=Path),
    required=True,
    metavar="PATH",
    help="Path to the keystore file.",
)
@click.password_option(
    "--password",
    type=str,
    default="",
    prompt=False,
    help="The password needed to unlock the keystore file.",
)
@click.option(
    "--artifacts-dir",
    type=click.Path(exists=True, file_okay=False, dir_okay=True, path_type=Path),
    required=True,
    metavar="DIR",
    help="The directory to store contract deployment artifacts in.",
)
@click.option(
    "--deploy-mintable-token",
    is_flag=True,
    help="Deploy MintableToken.sol on the specified chains.",
)
@click.argument(
    "chain.json",
    nargs=-1,
    required=True,
    type=click.Path(exists=True, file_okay=True, dir_okay=False, path_type=Path),
)
@click.option(
    "--commit-check",
    type=bool,
    default=True,
    show_default=True,
    help="Whether to check for commit on the remote.",
)
def deploy(
    rpc_file: Path,
    keystore_file: Path,
    password: str,
    artifacts_dir: Path,
    deploy_mintable_token: bool,
    commit_check: bool,
    **chains: dict,
) -> None:
    """Deploy L2 Beamer contracts on the specified chains and set up the trusted call chain."""
    beamer.util.setup_logging(log_level="DEBUG", log_json=False)
    if commit_check:
        _ensure_commit_is_on_remote()

    rpc_info = beamer.util.load_rpc_info(rpc_file)
    log.info("Loaded RPC file")

    account = beamer.util.account_from_keyfile(keystore_file, password)
    log.info("Loaded keystore file", address=account.address)

    path = artifacts_dir / "base.deployment.json"
    base_deployment = beamer.deploy.artifacts.Deployment.from_file(path)
    log.info(
        "Loaded base chain deployment", path=str(path), chain_id=base_deployment.base.chain_id
    )

    url = rpc_info[base_deployment.base.chain_id]
    base_w3 = make_web3(url, account)
    assert base_w3.eth.chain_id == base_deployment.base.chain_id
    log.info("Connected to base chain RPC", chain_id=base_deployment.base.chain_id, url=url)

    resolver = base_deployment.obtain_contract(base_w3, "base", "Resolver")

    for path in chains["chain.json"]:
        chain = beamer.deploy.config.Chain.from_file(path)
        log.info("Loaded chain config", name=chain.name, chain_id=chain.chain_id, path=str(path))

        url = rpc_info[chain.chain_id]
        w3 = make_web3(url, account, timeout=60)
        assert w3.eth.chain_id == chain.chain_id
        log.info("Connected to chain RPC", chain_id=chain.chain_id, url=url)

        l1_contracts, l2_contracts = deploy_beamer(w3, chain, resolver)
        if deploy_mintable_token:
            l2_contracts += (deploy_contract(w3, ("MintableToken", int(1e18))),)

        path = artifacts_dir / f"{chain.chain_id}-{chain.name}.deployment.json"
        beamer.deploy.artifacts.generate(path, account.address, l1_contracts, l2_contracts)
        log.info("Generated artifact", path=str(path))
