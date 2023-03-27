import contextlib
import json
import os
import signal
import sys
import time
from pathlib import Path
from subprocess import DEVNULL, PIPE

import ape
import eth_account
import psutil
import yaml
from eth_utils import to_canonical_address
from yaml.loader import SafeLoader

from beamer.agent.agent import Agent
from beamer.agent.config import Config
from beamer.agent.contracts import ContractInfo
from beamer.agent.typing import URL, BlockNumber, ChainId
from beamer.agent.util import TokenChecker, make_web3, transact
from beamer.tests.conftest import Contracts
from beamer.tests.util import Sleeper

_SLAVE_TEST_PATH = Path(__file__).parent / "_test_slave.py"
_CONFIG_PATH = ape.project.local_project.path / ape.project.local_project.config_file_name


# ape local account, to be used for fulfilling requests.
# The private key here corresponds to the 10th account ganache creates on
# startup.
_LOCAL_ACCOUNT = ape.accounts.test_accounts[-1]


def _start_ganache(chain_id: ChainId, port: int) -> psutil.Popen:
    cmd = [
        "ganache-cli",
        "--chain.vmErrorsOnRPCResponse",
        "true",
        "--server.port",
        str(port),
        "--miner.blockGasLimit",
        "12000000",
        "--wallet.totalAccounts",
        "10",
        "--hardfork",
        "istanbul",
        "--wallet.mnemonic",
        "brownie",
        "--chain.chainId",
        str(chain_id),
    ]
    return psutil.Popen(cmd, stdin=DEVNULL, stdout=PIPE, stderr=PIPE)


@contextlib.contextmanager
def _configure_ganache_port(port: int):
    with open(_CONFIG_PATH) as f:
        current_config = yaml.load(f, Loader=SafeLoader)
    backup_path = _CONFIG_PATH.parent / "ape-config.yaml.original"
    os.rename(_CONFIG_PATH, backup_path)
    current_config["ganache"]["server"]["port"] = port
    with open(_CONFIG_PATH, "w") as f:
        yaml.dump(current_config, f, sort_keys=False, default_flow_style=False)
    try:
        yield
    finally:
        os.rename(backup_path, _CONFIG_PATH)


def _start_slave_test(port: int, request_count: int) -> psutil.Popen:
    return psutil.Popen(
        ["ape", "test", str(_SLAVE_TEST_PATH), "-s"],
        stdin=PIPE,
        stdout=PIPE,
        stderr=PIPE,
        env=dict(os.environ, PORT=str(port), REQUEST_COUNT=str(request_count)),
    )


@contextlib.contextmanager
def _new_networks(chain_port_map: dict[ChainId, int]):
    processes = {}
    try:
        for chain_id, port in chain_port_map.items():
            processes[chain_id] = _start_ganache(chain_id, port)
        yield
    finally:
        for process in processes.values():
            os.kill(process.pid, signal.SIGKILL)
            process.wait()


def _get_chain_map() -> dict[ChainId, int]:
    number_of_chains = 4
    return {ChainId(i): i for i in range(8546, 8546 + number_of_chains)}


def _get_config(
    chain_map: dict[ChainId, int],
    contracts: Contracts,
    slave_contract_addresses: dict[ChainId, dict[str, str]],
) -> Config:
    account = eth_account.Account.from_key(_LOCAL_ACCOUNT.private_key)
    url = ape.config.provider.uri
    deployment_info = {}

    for chain_id in chain_map:
        contracts_info = dict(
            RequestManager=ContractInfo(
                deployment_block=BlockNumber(1),
                address=to_canonical_address(
                    slave_contract_addresses[chain_id]["request_manager"]
                ),
                abi=[abi.dict() for abi in contracts.request_manager.contract_type.abi],
            ),
            FillManager=ContractInfo(
                deployment_block=BlockNumber(1),
                address=to_canonical_address(slave_contract_addresses[chain_id]["fill_manager"]),
                abi=[abi.dict() for abi in contracts.fill_manager.contract_type.abi],
            ),
        )
        deployment_info[chain_id] = contracts_info
    rpc_urls = {}
    confirmation_blocks = {}
    for chain_id, port in chain_map.items():
        rpc_url = f"http://127.0.0.1:{port}"
        rpc_urls[str(chain_id)] = URL(rpc_url)
        confirmation_blocks[str(chain_id)] = 0

    token_list = _get_token_list(chain_map, slave_contract_addresses)
    config = Config(
        rpc_urls=rpc_urls,
        base_chain_rpc_url=url,
        deployment_info=deployment_info,
        confirmation_blocks=confirmation_blocks,
        token_checker=TokenChecker(token_list),
        account=account,
        fill_wait_time=0,
        unsafe_fill_time=600,
        prometheus_metrics_port=None,
        log_level="debug",
        poll_period=1.0,
        poll_period_per_chain={},
    )
    return config


def _start_agent_test(config: Config):
    agent = Agent(config)
    agent.start()

    directions = agent.get_directions()
    try:
        for direction in directions:
            with Sleeper(20) as sleeper:
                while len(agent.get_context(direction).requests) != 1:
                    sleeper.sleep(0.1)

            request = next(iter(agent.get_context(direction).requests))

            with Sleeper(20) as sleeper:
                while not request.claimed.is_active:
                    sleeper.sleep(0.1)
    finally:
        agent.stop()


def _get_slave_contract_addresses(proc: psutil.Popen) -> dict[str, str]:
    stdout = ""
    while proc.status() == "running":
        line = proc.stdout.readline().decode()
        stdout += line
        if "Chain is ready\n" == line:
            proc.stdin.write("get_contracts\n".encode())
            proc.stdin.flush()
            line = proc.stdout.readline().decode()
            contract_addresses = json.loads(line)
            return contract_addresses

    sys.stderr.write("Slave process exited before detecting contract addresses!\n")
    sys.stderr.write(stdout)
    sys.stderr.flush()
    sys.exit(1)


def _stop_slave_tests(slave_procs: list[psutil.Popen]):
    for proc in slave_procs:
        os.kill(proc.pid, signal.SIGKILL)
        proc.wait()


def _get_token_list(
    chain_map: dict[ChainId, int], slave_contract_addresses: dict[ChainId, dict[str, str]]
) -> list[list[list[str]]]:
    tokens: list[list[str]] = []
    for chain_id in chain_map:
        tokens.append([str(chain_id), slave_contract_addresses[chain_id]["token"]])
    return [tokens]


def _mint_agent_tokens(
    config: Config,
    token: ape.project.MintableToken,
    slave_contract_addresses: dict[ChainId, dict[str, str]],
):
    for chain_name, chain_rpc in config.rpc_urls.items():
        w3 = make_web3(chain_rpc, config.account)
        while not w3.is_connected():
            time.sleep(1)
        l2_token = w3.eth.contract(
            address=to_canonical_address(
                slave_contract_addresses[ChainId(int(chain_name))]["token"]
            ),
            abi=[abi.dict() for abi in token.contract_type.abi],
        )
        transact(l2_token.functions.mint(config.account.address, 300))


def test_multiple_event_processors(contracts: Contracts, token: ape.project.MintableToken):
    chain_map = _get_chain_map()
    with _new_networks(chain_map):
        slave_test_procs = []
        slave_contract_addresses: dict[ChainId, dict[str, str]] = {}
        for chain_id, port in chain_map.items():
            with _configure_ganache_port(port):
                slave = _start_slave_test(port, len(chain_map))
                contract_addresses = _get_slave_contract_addresses(slave)
                slave_contract_addresses[chain_id] = contract_addresses
                slave_test_procs.append(slave)
        config = _get_config(chain_map, contracts, slave_contract_addresses)
        _mint_agent_tokens(config, token, slave_contract_addresses)
        _start_agent_test(config)
        _stop_slave_tests(slave_test_procs)
