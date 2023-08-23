import pytest
from eth_account.account import Account
from hexbytes import HexBytes

from beamer.relayer import RelayerCommandError, run_relayer_for_tx
from beamer.typing import URL


@pytest.mark.usefixtures("setup_relayer_executable_with_error")
def test_redacted_private_key_log():
    account = Account.create()
    with pytest.raises(RelayerCommandError) as ex:
        run_relayer_for_tx(
            URL("1"),
            URL("2"),
            URL("3"),
            account,
            HexBytes("2"),
        )
    relayer_args = ex.value.cmd
    idx = relayer_args.index("--password")
    assert relayer_args[idx + 1] == "<REDACTED>"
