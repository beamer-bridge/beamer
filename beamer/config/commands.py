from pathlib import Path

import click
import structlog
from web3 import Web3

import beamer.contracts
import beamer.deploy.config
import beamer.util
from beamer.config.state import ChainConfig, Configuration, TokenConfig
from beamer.deploy.artifacts import Deployment
from beamer.events import (
    ChainUpdated,
    Event,
    EventFetcher,
    FeesUpdated,
    LpAdded,
    LpRemoved,
    TokenUpdated,
)
from beamer.util import get_ERC20_abi, make_web3

log = structlog.get_logger(__name__)


def _replay_event(w3: Web3, deployment: Deployment, config: Configuration, event: Event) -> None:
    assert deployment.chain is not None
    match event:
        case ChainUpdated():
            config.request_manager.chains[event.chain_id] = ChainConfig(
                finality_period=event.finality_period,
                target_weight_ppm=event.target_weight_ppm,
                transfer_cost=event.transfer_cost,
            )

        case FeesUpdated():
            config.request_manager.lp_fee_ppm = event.lp_fee_ppm
            config.request_manager.min_fee_ppm = event.min_fee_ppm
            config.request_manager.protocol_fee_ppm = event.protocol_fee_ppm

        case TokenUpdated():
            token = w3.eth.contract(address=event.token_address, abi=get_ERC20_abi())
            symbol = token.functions.symbol().call()
            config.request_manager.tokens[symbol] = TokenConfig(
                transfer_limit=event.transfer_limit, eth_in_token=event.eth_in_token
            )
            address = config.token_addresses.get(symbol)
            if address is None:
                config.token_addresses[symbol] = event.token_address
            else:
                assert address == event.token_address

        case LpAdded():
            if event.event_address == deployment.chain.contracts["RequestManager"].address:
                config.request_manager.whitelist.add(event.lp)
            elif event.event_address == deployment.chain.contracts["FillManager"].address:
                config.fill_manager.whitelist.add(event.lp)
            else:
                raise ValueError(f"event from an unexpected address: {event}")

        case LpRemoved():
            if event.event_address == deployment.chain.contracts["RequestManager"].address:
                config.request_manager.whitelist.remove(event.lp)
            elif event.event_address == deployment.chain.contracts["FillManager"].address:
                config.fill_manager.whitelist.remove(event.lp)
            else:
                raise ValueError(f"event from an unexpected address: {event}")


@click.group()
def config() -> None:
    pass


@config.command("read")
@click.option(
    "--rpc-file",
    type=click.Path(exists=True, file_okay=True, dir_okay=False, path_type=Path),
    required=True,
    help="Path to the RPC config file.",
)
@click.option(
    "--abi-dir",
    type=click.Path(exists=True, file_okay=False, dir_okay=True, path_type=Path),
    required=True,
    help="Path to the directory with contract ABIs.",
)
@click.option(
    "--artifact",
    type=click.Path(exists=True, file_okay=True, dir_okay=False, path_type=Path),
    required=True,
    help="Path to the deployment artifact.",
)
@click.argument("state_path", type=click.Path(file_okay=True, dir_okay=False, path_type=Path))
def read(
    rpc_file: Path, abi_dir: Path, artifact: Path, state_path: Path
) -> None:  # pylint: disable=unused-argument
    """Read latest contract configuration state from the chain and store it into STATE_PATH."""
    beamer.util.setup_logging(log_level="DEBUG", log_json=False)

    rpc_info = beamer.deploy.config.load_rpc_info(rpc_file)
    deployment = Deployment.from_file(artifact)

    assert deployment.chain is not None
    chain_id = deployment.chain.chain_id
    url = rpc_info[chain_id]
    w3 = make_web3(url)
    assert w3.eth.chain_id == chain_id
    log.info("Connected to RPC", url=url)

    request_manager = deployment.obtain_contract(w3, "chain", "RequestManager")
    fill_manager = deployment.obtain_contract(w3, "chain", "FillManager")

    if state_path.exists():
        config = Configuration.from_file(state_path)
        start_block = config.block
    else:
        start_block = min(
            deployment.chain.contracts["RequestManager"].deployment_block,
            deployment.chain.contracts["FillManager"].deployment_block,
        )
        config = Configuration.initial(chain_id, start_block)

    start_block = BlockNumber(start_block + 1)
    fetcher = EventFetcher(
        w3, (request_manager, fill_manager), start_block=start_block, confirmation_blocks=0
    )
    events = fetcher.fetch()
    for event in events:
        _replay_event(w3, deployment, config, event)

    config.block = fetcher.synced_block
    config.to_file(state_path)
    log.info("Stored configuration", path=str(state_path))
