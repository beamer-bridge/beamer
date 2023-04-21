from pathlib import Path

import click
import eth_account


@click.command()
@click.option("--password", type=str, default="", help="The keystore file password")
@click.argument(
    "keyfile",
    type=click.Path(file_okay=True, dir_okay=False, path_type=Path),
)
def main(password: str, keyfile: Path) -> None:
    with keyfile.open() as f:
        content = f.read()
    key = eth_account.Account.decrypt(content, password)
    print(key.hex())


if __name__ == "__main__":
    main()
