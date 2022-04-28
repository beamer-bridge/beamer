from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from eth_account.signers.local import LocalAccount

from beamer.contracts import DeploymentInfo
from beamer.typing import URL


@dataclass
class Config:
    account: LocalAccount
    deployment_info: DeploymentInfo
    l1_rpc_url: URL
    l2a_rpc_url: URL
    l2b_rpc_url: URL
    token_match_file: Path
    fill_wait_time: int
    prometheus_metrics_port: Optional[int]
