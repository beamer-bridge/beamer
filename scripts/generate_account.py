import json
import random
from pathlib import Path

import click
import eth_account


@click.command()
@click.option(
    "--key",
    type=str,
    metavar="KEY",
    help="Specify the private key to use instead of generating one.",
)
@click.argument(
    "output",
    type=click.Path(file_okay=True, dir_okay=False, path_type=Path),
)
def main(key: str, output: Path) -> None:
    if key is None:
        key = random.randbytes(32)
    account = eth_account.Account.from_key(key)
    obj = eth_account.account.create_keyfile_json(account.key, b"")
    output.write_text(json.dumps(obj))
    print(account.address)


if __name__ == "__main__":
    main()
