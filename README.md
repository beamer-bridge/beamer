[![Agent CI](https://github.com/beamer-bridge/beamer/actions/workflows/backend.yml/badge.svg)](https://github.com/beamer-bridge/beamer/actions/workflows/backend.yml)
[![Frontend CI](https://github.com/beamer-bridge/beamer/actions/workflows/frontend.yml/badge.svg)](https://github.com/beamer-bridge/beamer/actions/workflows/frontend.yml)

# Beamer Bridge
*Transfer ERC20 assets directly between EVM compatible rollups - with a world class user experience*

Beamer is a protocol to enable users to move tokens from one rollup to another.
The user requests a transfer by providing tokens on the source rollup.
Liquidity providers then fill the request and directly send tokens to the user
on the target rollup.

Documentation: https://docs.beamerbridge.com
Testnet frontend: https://testnet.beamerbridge.com


## Running an agent from source

Prerequisites: Python 3.9.x and Poetry

Clone this repository and enter the virtual environment:
```
    poetry shell
```

Install the necessary dependencies:
```
    poetry install
```

Finally, still within the virtual environment, run:
```
    beamer-agent --keystore-file <keyfile> \
                 --password <keyfile-password> \
                 --l1-rpc-url <l1-rpc-url> \
                 --l2a-rpc-url <source-l2-rpc-url> \
                 --l2b-rpc-url <target-l2-rpc-url> \
                 --deployment-dir <contract-deployment-dir> \
                 --token-match-file <token-match-file>
```

For more comprehensive documentation go to [Beamer documenation](https://docs.beamerbridge.com).
