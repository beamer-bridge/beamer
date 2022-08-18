import json
import random
from pathlib import Path

import click
import eth_account
from eth_utils import to_checksum_address


@click.command()
@click.option(
    "--key",
    type=str,
    metavar="KEY",
    help="Specify the private key to use instead of generating one.",
)
@click.option(
    "--password", type=str, required=True, help="Choose a password to encrypt the keystore file"
)
@click.argument(
    "output",
    type=click.Path(file_okay=True, dir_okay=False, path_type=Path),
)
def main(key: str, password: str, output: Path) -> None:
    if key is None:
        key = random.randbytes(32)

    obj = eth_account.Account.encrypt(key, password)
    output.write_text(json.dumps(obj))
    print(to_checksum_address(obj["address"]))


if __name__ == "__main__":
    main()
