import time
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import DefaultDict, TypedDict, cast

import toml
from eth_typing import BlockNumber
from eth_utils import to_checksum_address
from typing_extensions import NotRequired
from web3 import Web3
from web3.constants import ADDRESS_ZERO
from web3.middleware import geth_poa_middleware

import beamer.agent.contracts
import beamer.agent.events
from beamer.agent.config import _merge_dicts
from beamer.agent.events import ClaimMade, DepositWithdrawn, RequestCreated, RequestFilled
from beamer.agent.typing import ChainId
from beamer.agent.util import load_ERC20_abi
from beamer.health.notify import Message, NotificationConfig, NotificationState, Notify


class NotificationTypes:
    REQUEST_EXPIRED = "RequestExpired"
    DEPOSIT_WITHDRAWN = "DepositWithdrawn"
    UNCLAIMED_FILL = "UnclaimedFill"
    CHALLENGE_GAME = "ChallengeGame"
    CHALLENGE_GAME_CLAIMED_BY_SOMEONE_ELSE = "ChallengeGameClaimedBySomeoneElse"


TokenMap = dict[str, list[tuple[str, str]]]


class HealthConfig(TypedDict):
    agent_address: str
    deployment_dir: Path
    cache_file_path: Path
    notification_system: str
    rpcs: dict[int, str]
    explorers: dict[int, str]
    notification: NotificationConfig
    tokens: TokenMap


class Transfer(TypedDict):
    created: NotRequired[RequestCreated]
    filled: NotRequired[RequestFilled]
    claimed: NotRequired[dict[int, list[ClaimMade]]]
    withdrawn: NotRequired[DepositWithdrawn]


TransferMap = DefaultDict[str, Transfer]

ChainEventMap = dict[ChainId, list[beamer.agent.events.Event]]


class NotificationMeta(TypedDict):
    request_id: str
    message_type: str
    message_link: str


class Notification(TypedDict):
    meta: NotificationMeta
    body: str


@dataclass
class Stats:
    fills: int = 0
    requests: int = 0
    withdraws: int = 0
    volume: int = 0


@dataclass
class TransferStats:
    volume: int = 0
    fills: int = 0
    requests: int = 0
    withdrawals: int = 0
    claims: int = 0
    expired_requests: int = 0
    expired_requests_volume: int = 0


@dataclass
class Context:
    stats: TransferStats = field(default_factory=TransferStats)
    notifications: list = field(default_factory=list)
    agent_address: str = ""

    notification_state: NotificationState = NotificationState(Path("chain/"))

    def add_notification(self, message: Notification) -> None:
        self.notifications.append(message)


claim_request_extension = 86400
GLOBAL_CONFIG: None | HealthConfig = None


def _default_config() -> dict:
    return {"chains": {}, "tokens": {}}


def _set_config(path: Path) -> None:
    global GLOBAL_CONFIG

    config = _default_config()

    if path is not None:
        config = _merge_dicts(config, toml.load(path))

    rpcs = {}
    explorers = {}
    for _key, chains in config["chains"].items():
        chain_id = int(chains["chain-id"])

        rpcs[chain_id] = chains["rpc-url"]
        explorers[chain_id] = chains["explorer"]

    GLOBAL_CONFIG = {
        "agent_address": config["agent-address"].lower(),
        "deployment_dir": Path(config["deployment-dir"]),
        "cache_file_path": Path(config["cache-file-path"]),
        "notification_system": config["notification-system"],
        "rpcs": rpcs,
        "explorers": explorers,
        "notification": config["notification"],
        "tokens": config["tokens"],
    }


def get_config() -> HealthConfig:
    assert GLOBAL_CONFIG is not None
    return GLOBAL_CONFIG


def main(
    config_path: Path,
) -> None:

    _set_config(config_path)

    config = get_config()

    ctx = Context()
    ctx.agent_address = config["agent_address"]
    ctx.notification_state = NotificationState(config["cache_file_path"])
    ctx.notification_state.persist()

    transfers = create_transfers_object(fetch_events())

    cleanup_transfers(transfers)

    analyze_transfers(transfers, ctx)


def cleanup_transfers(transfers: TransferMap) -> None:
    for request_id, values in transfers.copy().items():
        if values.get("created") is None:
            del transfers[request_id]

        claims = values.get("claimed")
        if claims is not None:
            for events in claims.values():
                events.sort(key=lambda a: -1 if a.last_challenger == ADDRESS_ZERO else 1)


def fetch_events() -> ChainEventMap:
    deployment_info = beamer.agent.contracts.load_deployment_info(get_config()["deployment_dir"])
    events = {}

    for chain_id, (rpc) in get_config()["rpcs"].items():
        web3 = make_web3(rpc)
        assert chain_id == ChainId(web3.eth.chain_id)

        info = deployment_info[ChainId(chain_id)]
        contracts = beamer.agent.contracts.make_contracts(web3, info)

        ef = beamer.agent.events.EventFetcher(
            web3,
            (contracts["RequestManager"], contracts["FillManager"]),
            BlockNumber(info["RequestManager"].deployment_block),
        )

        events[chain_id] = ef.fetch()

    return cast(ChainEventMap, events)


def make_web3(rpc: str) -> Web3:
    web3 = Web3(Web3.HTTPProvider(rpc, request_kwargs=dict(timeout=5)))
    web3.middleware_onion.inject(geth_poa_middleware, layer=0)
    return web3


def get_agent_liquidity(
    agent_address: str, rpcs: dict, tokens: TokenMap
) -> dict[str, dict[ChainId, int]]:
    contract_abi = load_ERC20_abi()
    liquidity: dict = defaultdict(dict)
    agent_address = to_checksum_address(agent_address)

    for name, chain_to_token_mapping in tokens.items():
        for chain_id, token_address in chain_to_token_mapping:
            contract_address = to_checksum_address(token_address)
            web3 = make_web3(rpcs[int(chain_id)])
            contract = web3.eth.contract(address=contract_address, abi=contract_abi)
            token_decimals = contract.functions.decimals().call()
            balance = contract.functions.balanceOf(agent_address).call()
            liquidity[name][chain_id] = balance * 10**-token_decimals

    for chain_id, (rpc) in rpcs.items():
        web3 = make_web3(rpc)
        agent_address = to_checksum_address(agent_address)
        assert ChainId(int(chain_id)) == ChainId(web3.eth.chain_id)
        balance = web3.eth.get_balance(agent_address)
        liquidity["eth"][chain_id] = balance * 10**-18

    return liquidity


def create_transfers_object(events_grouped_by_chain_id: ChainEventMap) -> TransferMap:
    transfers = defaultdict(dict)  # type: ignore[var-annotated]

    for events in events_grouped_by_chain_id.values():
        for x in events:
            if isinstance(x, beamer.agent.events.RequestCreated):
                transfers[x.request_id.hex()]["created"] = x
            elif isinstance(x, beamer.agent.events.RequestFilled):
                transfers[x.request_id.hex()]["filled"] = x
            elif isinstance(x, beamer.agent.events.DepositWithdrawn):
                transfers[x.request_id.hex()]["withdrawn"] = x
            elif isinstance(x, beamer.agent.events.ClaimMade):
                claims = transfers[x.request_id.hex()].get("claimed", {})

                if x.claim_id not in claims:
                    claims[x.claim_id] = []

                claims[x.claim_id].append(x)

                transfers[x.request_id.hex()]["claimed"] = claims

    return cast(TransferMap, transfers)


def link_to_explorer(chain_id: int, tx_hash: str) -> str:
    return f"{get_config()['explorers'][chain_id]}{tx_hash}"


def analyze_transfer(transfer: Transfer, ctx: Context) -> None:
    _check_if_request_created(transfer, ctx)
    _check_if_request_has_fill(transfer, ctx)
    _check_if_claim_is_made_for_fill(transfer, ctx)
    _check_if_challenge_game(transfer, ctx)
    _check_if_request_has_been_withdrawn(transfer, ctx)


def _check_if_request_created(transfer: Transfer, ctx: Context) -> None:
    if "created" in transfer:
        ctx.stats.requests += 1


def _check_if_request_has_fill(transfer: Transfer, ctx: Context) -> None:
    if "created" not in transfer:
        return

    if "filled" in transfer:
        ctx.stats.fills += 1
        ctx.stats.volume += transfer["created"].amount
    else:
        if transfer["created"].valid_until < time.time():
            request = transfer["created"]
            ctx.stats.expired_requests += 1

            if not ctx.notification_state.is_set(
                request.request_id.hex(), NotificationTypes.REQUEST_EXPIRED
            ):
                ctx.add_notification(create_expired_request_notification(request))


def _check_if_claim_is_made_for_fill(transfer: Transfer, ctx: Context) -> None:
    if "created" not in transfer:
        return

    if "filled" not in transfer:
        return

    if "claimed" in transfer:
        ctx.stats.claims += 1
    else:
        request = transfer["created"]
        fill = transfer["filled"]

        if ctx.agent_address and fill.filler != ctx.agent_address:
            return

        if "withdrawn" not in transfer:
            if transfer["created"].valid_until + claim_request_extension > time.time():
                if not ctx.notification_state.is_set(
                    request.request_id.hex(), NotificationTypes.UNCLAIMED_FILL
                ):
                    ctx.add_notification(create_unclaimed_fill_notification(request, fill))


def _check_if_challenge_game(transfer: Transfer, ctx: Context) -> None:
    if "filled" not in transfer:
        return

    if "claimed" not in transfer:
        return

    request = transfer["created"]
    fill = transfer["filled"]
    claim_events = transfer["claimed"]

    agent_participating = False
    for claims in claim_events.values():
        if any(
            ctx.agent_address in [obj.claimer.lower(), obj.last_challenger.lower()]
            for obj in claims
        ):
            agent_participating = True

    agent_filled = fill.filler == ctx.agent_address

    if ctx.agent_address and not (agent_filled or agent_participating):
        return

    for claims in claim_events.values():
        last_claim = claims[-1]
        if len(claims) == 1:
            if agent_filled and fill.filler != last_claim.claimer:
                if not ctx.notification_state.is_set(
                    request.request_id.hex(),
                    NotificationTypes.CHALLENGE_GAME_CLAIMED_BY_SOMEONE_ELSE,
                ):
                    ctx.add_notification(
                        create_challenge_game_notification(
                            NotificationTypes.CHALLENGE_GAME_CLAIMED_BY_SOMEONE_ELSE,
                            request,
                            fill,
                            last_claim,
                        )
                    )
            continue

        if len(claims) > 1:
            if not ctx.notification_state.is_set(
                request.request_id.hex(), NotificationTypes.CHALLENGE_GAME
            ):
                ctx.add_notification(
                    create_challenge_game_notification(
                        NotificationTypes.CHALLENGE_GAME, request, fill, last_claim
                    )
                )


def _check_if_request_has_been_withdrawn(transfer: Transfer, ctx: Context) -> None:
    if "created" not in transfer:
        return

    if "withdrawn" in transfer:
        ctx.stats.withdrawals += 1

        request = transfer["created"]
        withdrawal = transfer["withdrawn"]

        # if request was withdrawn by user, sum missed agent volume
        if withdrawal.receiver == request.source_address:
            ctx.stats.expired_requests_volume += request.amount


def analyze_transfers(transfers: TransferMap, ctx: Context) -> None:
    config = get_config()

    for transfer in transfers.values():
        analyze_transfer(transfer, ctx)

    process_notifications(ctx)

    processing_status = (
        "^^ Something is going on. Look at the previous messages ^^."
        if len(ctx.notifications)
        else "Everything is calm in Beamerland."
    )

    message: Message = {
        "text": f"""
v1: Processing complete. {processing_status}
{render_liquidity_info()}
Total requests in network: {ctx.stats.requests}
Total expired requests in network: {ctx.stats.expired_requests}
Total fills in network: {ctx.stats.fills}
Total claims in network: {ctx.stats.claims}
Total withdrawals in network: {ctx.stats.withdrawals}
Total total volume in network: {ctx.stats.volume * 1e-6} USDC
Total expired requests volume in network: {ctx.stats.expired_requests_volume * 1e-6} USDC
    """,  # noqa: E501
    }

    notify = Notify(config["notification_system"], config["notification"])
    notify.send(message)

    ctx.notification_state.persist()


def render_liquidity_info() -> str:
    config = get_config()
    agent_address = config["agent_address"]
    liquidity_text = ""
    if agent_address:
        liquidity = get_agent_liquidity(agent_address, config["rpcs"], config["tokens"])
        liquidity_text += "========================= \n"
        liquidity_text += f"Liquidity info for agent {agent_address}: \n"

        for token, chain_amounts in liquidity.items():
            for (chain, amount) in chain_amounts.items():
                liquidity_text += f"{token} | {chain}: {amount} \n"

        liquidity_text += "========================= \n"

    return liquidity_text


def create_unclaimed_fill_notification(
    request: RequestCreated, fill: RequestFilled
) -> Notification:
    return {
        "meta": {
            "request_id": request.request_id.hex(),
            "message_type": NotificationTypes.UNCLAIMED_FILL,
            "message_link": link_to_explorer(request.chain_id, request.tx_hash.hex()),
        },
        "body": f"""
v1: Unclaimed fill!
Request: `{request.request_id.hex()}`
Value: `{request.amount}` | `{request.amount * 1e-6}` USDC
Block: `{request.block_number}`
Filler: `{fill.filler}`
TX_Hash `{fill.tx_hash.hex()}`
Valid_until: {request.valid_until} | `{datetime.fromtimestamp(request.valid_until)
        .strftime("%d.%m.%Y %H:%M:%S")}`
        """,
    }


def create_expired_request_notification(request: RequestCreated) -> Notification:
    return {
        "meta": {
            "request_id": request.request_id.hex(),
            "message_type": NotificationTypes.REQUEST_EXPIRED,
            "message_link": link_to_explorer(request.chain_id, request.tx_hash.hex()),
        },
        "body": f"""
Request expired with no fill {request.request_id.hex()}
Request: `{request.request_id.hex()}`
Value: `{request.amount}` | `{request.amount * 1e-6}` USDC
Valid_until: {request.valid_until} | `{datetime.fromtimestamp(request.valid_until)
        .strftime("%d.%m.%Y %H:%M:%S")}`
TX_Hash `{request.tx_hash.hex()}`
        """,
    }


def create_challenge_game_notification(
    message_type: str, request: RequestCreated, fill: RequestFilled, last_claim: ClaimMade
) -> Notification:
    title = {
        NotificationTypes.CHALLENGE_GAME: "Challenge game!",
        NotificationTypes.CHALLENGE_GAME_CLAIMED_BY_SOMEONE_ELSE: "Claimed by someone else!",
    }

    return {
        "meta": {
            "request_id": request.request_id.hex(),
            "message_type": message_type,
            "message_link": link_to_explorer(request.chain_id, last_claim.tx_hash.hex()),
        },
        "body": f"""
v1: {title[message_type]}
Request: `{request.request_id.hex()}`
Claim_id: `{last_claim.claim_id}`
Request filled by: `{fill.filler}` | `{fill.tx_hash.hex()}`
Claimer: `{last_claim.claimer}`
Last_challenger: `{last_claim.last_challenger}`
Fill_id: `{fill.fill_id.hex()}`
Claimer_stake: `{last_claim.claimer_stake}` | `{Web3.fromWei(last_claim.claimer_stake, 'ether')}` ethers
Challenger_stake_total: `{last_claim.challenger_stake_total}` | `{Web3.fromWei(last_claim.challenger_stake_total, 'ether')}` ETH
Block: `{last_claim.block_number}`
Terminates: `{last_claim.termination}` | `{datetime.fromtimestamp(last_claim.termination).strftime("%d.%m.%Y %H:%M:%S")}`
TX_Hash `{last_claim.tx_hash.hex()}`
       """,  # noqa: E501
    }


def process_notifications(ctx: Context) -> None:
    notify = Notify(get_config()["notification_system"], get_config()["notification"])
    for notification in ctx.notifications:

        def callback(notif: Notification = notification) -> None:
            ctx.notification_state.update(
                str(notif["meta"]["request_id"]), notif["meta"]["message_type"]
            )

        notify.send(
            {"text": notification["body"], "message_link": notification["meta"]["message_link"]},
            callback,
        )
