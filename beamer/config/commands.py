import sys
from pathlib import Path
from typing import Generator

import click
import structlog
from eth_typing import ChecksumAddress
from web3 import Web3

import beamer.contracts
import beamer.util
from beamer.artifacts import Deployment
from beamer.config.state import ChainConfig, Configuration, DesiredConfiguration, TokenConfig
from beamer.contracts import ABIManager, obtain_contract
from beamer.events import (
    ChainUpdated,
    Event,
    EventFetcher,
    FeesUpdated,
    LpAdded,
    LpRemoved,
    TokenUpdated,
)
from beamer.typing import BlockNumber
from beamer.util import get_ERC20_abi, make_web3

log = structlog.get_logger(__name__)


_CONFIG_UPDATE_EVENTS = frozenset((ChainUpdated, FeesUpdated, TokenUpdated, LpAdded, LpRemoved))


def _is_config_update_event(event: Event) -> bool:
    return type(event) in _CONFIG_UPDATE_EVENTS


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
                if event.lp not in config.request_manager.whitelist:
                    config.request_manager.whitelist.append(event.lp)
            elif event.event_address == deployment.chain.contracts["FillManager"].address:
                if event.lp not in config.fill_manager.whitelist:
                    config.fill_manager.whitelist.append(event.lp)
            else:
                raise ValueError(f"event from an unexpected address: {event}")

        case LpRemoved():
            if event.event_address == deployment.chain.contracts["RequestManager"].address:
                config.request_manager.whitelist.remove(event.lp)
            elif event.event_address == deployment.chain.contracts["FillManager"].address:
                config.fill_manager.whitelist.remove(event.lp)
            else:
                raise ValueError(f"event from an unexpected address: {event}")


def _ensure_config_chain_id_matches_deployment_chain_id(
    config: Configuration, deployment: Deployment
) -> None:
    assert deployment.chain is not None
    if config.chain_id != deployment.chain.chain_id:
        log.error(
            "Configuration chain ID differs from the deployment chain ID",
            config_chain_id=config.chain_id,
            deployment_chain_id=deployment.chain.chain_id,
        )
        sys.exit(1)


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

    rpc_info = beamer.util.load_rpc_info(rpc_file)
    deployment = Deployment.from_file(artifact)

    assert deployment.chain is not None
    chain_id = deployment.chain.chain_id
    url = rpc_info[chain_id]
    w3 = make_web3(url)
    assert w3.eth.chain_id == chain_id
    log.info("Connected to RPC", url=url)

    abi_manager = ABIManager(abi_dir)
    request_manager = obtain_contract(w3, abi_manager, deployment, "RequestManager")
    fill_manager = obtain_contract(w3, abi_manager, deployment, "FillManager")

    if state_path.exists():
        config = Configuration.from_file(state_path)
        _ensure_config_chain_id_matches_deployment_chain_id(config, deployment)
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
    events = list(filter(_is_config_update_event, events))
    for event in events:
        _replay_event(w3, deployment, config, event)

    if events:
        log.info("Found configuration updates", num_events=len(events))
    else:
        log.info("No configuration updates found")

    config.block = fetcher.synced_block
    state_path.parent.mkdir(parents=True, exist_ok=True)
    config.to_file(state_path)
    log.info("Stored configuration", path=str(state_path))


def _generate_fee_updates(
    current_config: Configuration, desired_config: DesiredConfiguration
) -> Generator[tuple, None, None]:
    current_rm = current_config.request_manager
    desired_rm = desired_config.request_manager

    # Fees. Note the order of elements in the tuple must match the order of contract function
    # arguments.
    current_fees = current_rm.min_fee_ppm, current_rm.lp_fee_ppm, current_rm.protocol_fee_ppm
    desired_fees = desired_rm.min_fee_ppm, desired_rm.lp_fee_ppm, desired_rm.protocol_fee_ppm
    if current_fees != desired_fees:
        yield "RequestManager", "updateFees", *desired_fees


def _generate_chain_updates(
    current_config: Configuration, desired_config: DesiredConfiguration
) -> Generator[tuple, None, None]:
    current_chains = current_config.request_manager.chains
    desired_chains = desired_config.request_manager.chains

    # We don't support chain removals yet.
    assert set(current_chains).issubset(desired_chains)

    for chain_id, desired_chain in desired_chains.items():
        current_chain = current_chains.get(chain_id)
        if current_chain is None or current_chain != desired_chain:
            yield (
                "RequestManager",
                "updateChain",
                chain_id,
                desired_chain.finality_period,
                desired_chain.transfer_cost,
                desired_chain.target_weight_ppm,
            )


def _generate_token_updates(
    current_config: Configuration, desired_config: DesiredConfiguration
) -> Generator[tuple, None, None]:
    current_tokens = current_config.request_manager.tokens
    desired_tokens = desired_config.request_manager.tokens

    # First check for removed tokens.
    for symbol in current_tokens:
        if symbol not in desired_tokens:
            address = current_config.token_addresses[symbol]
            # The token is disabled by setting its transfer limit to zero,
            # but we set also eth_in_token to zero.
            yield "RequestManager", "updateToken", address, 0, 0

    # Then check for newly added and modified tokens.
    for symbol, desired_token in desired_tokens.items():
        current_token = current_tokens.get(symbol)
        if current_token is None or current_token != desired_token:
            address = desired_config.token_addresses[symbol]
            yield (
                "RequestManager",
                "updateToken",
                address,
                desired_token.transfer_limit,
                desired_token.eth_in_token,
            )


def _generate_whitelist_updates(
    current_config: Configuration, desired_config: DesiredConfiguration
) -> Generator[tuple, None, None]:
    def helper(
        contract: str,
        current_whitelist: set[ChecksumAddress],
        desired_whitelist: set[ChecksumAddress],
    ) -> Generator[tuple, None, None]:
        for address in current_whitelist - desired_whitelist:
            yield contract, "removeAllowedLp", address

        for address in desired_whitelist - current_whitelist:
            yield contract, "addAllowedLp", address

    yield from helper(
        "RequestManager",
        set(current_config.request_manager.whitelist),
        set(desired_config.request_manager.whitelist),
    )
    yield from helper(
        "FillManager",
        set(current_config.fill_manager.whitelist),
        set(desired_config.fill_manager.whitelist),
    )


def _generate_updates(
    current_config: Configuration, desired_config: DesiredConfiguration
) -> Generator[tuple, None, None]:
    yield from _generate_fee_updates(current_config, desired_config)
    yield from _generate_chain_updates(current_config, desired_config)
    yield from _generate_token_updates(current_config, desired_config)
    yield from _generate_whitelist_updates(current_config, desired_config)


def _ensure_same_tokens_have_same_addresses(
    current_config: Configuration, desired_config: DesiredConfiguration
) -> None:
    common_symbols = set(current_config.token_addresses) & set(desired_config.token_addresses)
    for symbol in common_symbols:
        current_address = current_config.token_addresses[symbol]
        desired_address = desired_config.token_addresses[symbol]
        if current_address != desired_address:
            log.error(
                "Token symbol refers to different addresses",
                symbol=symbol,
                current_address=current_address,
                desired_address=desired_address,
            )
            sys.exit(1)


def _ensure_no_config_updates_since(
    w3: Web3, abi_manager: ABIManager, deployment: Deployment, start_block: BlockNumber
) -> None:
    request_manager = obtain_contract(w3, abi_manager, deployment, "RequestManager")
    fill_manager = obtain_contract(w3, abi_manager, deployment, "FillManager")

    fetcher = EventFetcher(
        w3, (request_manager, fill_manager), start_block=start_block, confirmation_blocks=0
    )
    events = fetcher.fetch()

    if any(_is_config_update_event(event) for event in events):
        log.error("Found configuration update event since start block", start_block=start_block)
        sys.exit(1)


def _ensure_config_block_not_in_future(w3: Web3, config: Configuration) -> None:
    latest_block = w3.eth.block_number
    if config.block > latest_block:
        log.error(
            "Block number of current configuration is in the future",
            block_number=config.block,
            latest_block=latest_block,
        )
        sys.exit(1)


def _ensure_same_chain_ids(
    current_config: Configuration, desired_config: DesiredConfiguration
) -> None:
    if current_config.chain_id != desired_config.chain_id:
        log.error(
            "Chain ID differs between current configuration and desired configuration",
            chain1=current_config.chain_id,
            chain2=desired_config.chain_id,
        )
        sys.exit(1)


@config.command("write")
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
@click.argument(
    "current_state_path",
    type=click.Path(file_okay=True, dir_okay=False, exists=True, path_type=Path),
)
@click.argument(
    "desired_state_path",
    type=click.Path(file_okay=True, dir_okay=False, exists=True, path_type=Path),
)
def write(
    rpc_file: Path,
    abi_dir: Path,
    artifact: Path,
    keystore_file: Path,
    password: str,
    current_state_path: Path,
    desired_state_path: Path,
) -> None:  # pylint: disable=unused-argument
    """Read contract configuration from CURRENT_STATE_PATH and DESIRED_STATE_PATH
    and issue transactions so that the on-chain configuration matches the desired one."""
    beamer.util.setup_logging(log_level="DEBUG", log_json=False)

    account = beamer.util.account_from_keyfile(keystore_file, password)
    log.info("Loaded keystore file", address=account.address)

    rpc_info = beamer.util.load_rpc_info(rpc_file)
    deployment = Deployment.from_file(artifact)

    assert deployment.chain is not None
    chain_id = deployment.chain.chain_id
    url = rpc_info[chain_id]
    w3 = make_web3(url, account)
    assert w3.eth.chain_id == chain_id
    log.info("Connected to RPC", url=url)

    abi_manager = ABIManager(abi_dir)
    current_config = Configuration.from_file(current_state_path)
    desired_config = DesiredConfiguration.from_file(desired_state_path)

    _ensure_config_chain_id_matches_deployment_chain_id(current_config, deployment)
    _ensure_config_block_not_in_future(w3, current_config)
    _ensure_same_tokens_have_same_addresses(current_config, desired_config)
    _ensure_same_chain_ids(current_config, desired_config)

    # Current configuration is only valid for current_config.block.
    # This means we need to make sure that there were no config updates
    # in block range [current_config.block + 1, latest_block].
    start_block = BlockNumber(current_config.block + 1)
    _ensure_no_config_updates_since(w3, abi_manager, deployment, start_block)

    for contract, function, *args in _generate_updates(current_config, desired_config):
        log.info("Sending transaction", call=f"{contract}.{function}({', '.join(map(str, args))})")
        contract = obtain_contract(w3, abi_manager, deployment, contract)
        call = getattr(contract.functions, function)(*args)
        try:
            receipt = beamer.util.transact(call)
        except beamer.util.TransactionFailed as exc:
            log.error("Transaction failed", exc=exc)
            sys.exit(1)
        else:
            txhash = receipt.transactionHash.hex()
            log.info("Transaction sent", block=receipt.blockNumber, txhash=txhash)
