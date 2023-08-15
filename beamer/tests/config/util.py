import pathlib
import tempfile

import beamer.config.commands
from beamer.config.state import Configuration
from beamer.tests.util import get_repo_root, run_command


def read_config_state(rpc_file, artifact):
    root = get_repo_root()
    with tempfile.TemporaryDirectory() as tmp_path:
        state_path = pathlib.Path(tmp_path) / "config.state"
        run_command(
            beamer.config.commands.read,
            (
                "--rpc-file",
                rpc_file,
                "--abi-dir",
                f"{root}/contracts/.build/",
                "--artifact",
                artifact,
                str(state_path),
            ),
        )
        return Configuration.from_file(state_path)
