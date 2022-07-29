import copy
import itertools
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

import toml
from eth_account.signers.local import LocalAccount

from beamer.contracts import DeploymentInfo, load_deployment_info
from beamer.typing import URL
from beamer.util import TokenMatchChecker, account_from_keyfile


class ConfigError(Exception):
    pass


@dataclass
class Config:
    account: LocalAccount
    deployment_info: DeploymentInfo
    l1_rpc_url: URL
    l2a_rpc_url: URL
    l2b_rpc_url: URL
    token_match_checker: TokenMatchChecker
    fill_wait_time: int
    prometheus_metrics_port: Optional[int]
    log_level: str


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
        "log-level": "info",
        "account": {},
        "chains": {},
        "metrics": {},
        "tokens": {},
    }


_REQUIRED_KEYS = (
    "source-chain",
    "target-chain",
    "deployment-dir",
    "fill-wait-time",
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

    # verify that l1, source and target chains are present
    for chain_name in ("l1", config["source-chain"], config["target-chain"]):
        key = f"chains.{chain_name}.rpc-url"
        if _lookup_value(config, key) is None:
            raise ConfigError(f"missing settings: {key}")

    l1_rpc_url = URL(_get_value(config, "chains.l1.rpc-url"))
    source_rpc_url = URL(_get_value(config, f"chains.{config['source-chain']}.rpc-url"))
    target_rpc_url = URL(_get_value(config, f"chains.{config['target-chain']}.rpc-url"))

    path = Path(_get_value(config, "account.path"))
    password = _get_value(config, "account.password")
    account = account_from_keyfile(path, password)

    deployment_info = load_deployment_info(Path(config["deployment-dir"]))
    token_match_checker = TokenMatchChecker(list(config["tokens"].values()))
    return Config(
        account=account,
        deployment_info=deployment_info,
        l1_rpc_url=l1_rpc_url,
        l2a_rpc_url=source_rpc_url,
        l2b_rpc_url=target_rpc_url,
        token_match_checker=token_match_checker,
        fill_wait_time=config["fill-wait-time"],
        prometheus_metrics_port=_lookup_value(config, "metrics.prometheus-port"),
        log_level=_get_value(config, "log-level"),
    )
