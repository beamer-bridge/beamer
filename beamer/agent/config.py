import copy
import itertools
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

import toml
from eth_account.signers.local import LocalAccount

from beamer.agent.contracts import DeploymentInfo, load_deployment_info
from beamer.agent.typing import URL
from beamer.agent.util import TokenChecker, account_from_keyfile


class ConfigError(Exception):
    pass


@dataclass
class Config:
    account: LocalAccount
    deployment_info: DeploymentInfo
    rpc_urls: dict[str, URL]
    token_checker: TokenChecker
    fill_wait_time: int
    unsafe_fill_time: int
    prometheus_metrics_port: Optional[int]
    log_level: str
    poll_period: float
    poll_period_per_chain: dict[str, float]


def _set_value(config: dict[str, Any], key: str, value: Any) -> None:
    obj = config
    keys = key.split(".")
    for key in keys[:-1]:
        obj = obj.setdefault(key, {})
    obj[keys[-1]] = value


def _lookup_value(config: dict[str, Any], key: str) -> Optional[Any]:
    obj = config
    for key_ in key.split("."):
        obj = obj.get(key_)  # type: ignore
        if obj is None:
            return None
    return obj


def _get_value(config: dict[str, Any], key: str) -> Any:
    value = _lookup_value(config, key)
    assert value is not None
    return value


def _merge_dicts(a: dict[str, Any], b: dict[str, Any]) -> dict[str, Any]:
    result = {}
    none = object()
    for key in itertools.chain(a, b):
        avalue = a.get(key, none)
        bvalue = b.get(key, none)
        atype = type(avalue)
        btype = type(bvalue)
        if avalue is none:
            result[key] = copy.deepcopy(bvalue)
        elif bvalue is none:
            result[key] = copy.deepcopy(avalue)
        else:
            if atype is not btype:
                raise ValueError("different types for key %r: %r, %r" % (key, atype, btype))
            if atype is dict:
                result[key] = _merge_dicts(avalue, bvalue)
            else:
                # b overrides a
                result[key] = copy.deepcopy(bvalue)
    return result


def _default_config() -> dict:
    return {
        "fill-wait-time": 120,
        "unsafe-fill-time": 600,
        "log-level": "info",
        "account": {},
        "rpc_urls": {},
        "metrics": {},
        "tokens": {},
        "poll-period": 5.0,
    }


_REQUIRED_KEYS = (
    "deployment-dir",
    "fill-wait-time",
    "unsafe-fill-time",
    "account.path",
    "account.password",
)


def load(config_path: Path, options: dict[str, Any]) -> Config:
    config = _default_config()

    if config_path is not None:
        config = _merge_dicts(config, toml.load(config_path))

    for key, value in options.items():
        if value is not None:
            _set_value(config, key, value)

    missing = tuple(key for key in _REQUIRED_KEYS if _lookup_value(config, key) is None)
    if missing:
        raise ConfigError(f"missing settings: {missing}")

    rpc_urls = {}
    poll_period_per_chain = {}

    for chain_name, chain_info in config["chains"].items():
        rpc_urls[chain_name] = URL(chain_info["rpc-url"])
        poll_period = chain_info.get("poll-period")
        if poll_period is not None:
            poll_period_per_chain[chain_name] = float(poll_period)

    path = Path(_get_value(config, "account.path"))
    password = _get_value(config, "account.password")
    account = account_from_keyfile(path, password)

    deployment_info = load_deployment_info(Path(config["deployment-dir"]))
    token_checker = TokenChecker(list(config["tokens"].values()))

    return Config(
        account=account,
        deployment_info=deployment_info,
        rpc_urls=rpc_urls,
        token_checker=token_checker,
        fill_wait_time=config["fill-wait-time"],
        unsafe_fill_time=config["unsafe-fill-time"],
        prometheus_metrics_port=_lookup_value(config, "metrics.prometheus-port"),
        log_level=_get_value(config, "log-level"),
        poll_period=config["poll-period"],
        poll_period_per_chain=poll_period_per_chain,
    )
