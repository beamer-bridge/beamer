# Beamer Bridge
*Bridging rollups with L1 inherited security*


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
                 --l2a-rpc-url <source-l2-rpc-url> \
                 --l2b-rpc-url <target-l2-rpc-url> \
                 --deployment-dir <contract-deployment-dir> \
                 --token-match-file <token-match-file>
```

For more comprehensive documentation go to [Beamer documenation](https://docs.beamerbridge.com).
