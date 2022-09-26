# Changelog

## v0.1.8 (2022-09-26)

* agent: improve state machine for ClaimMade events
* agent: allow more transitions in the claim state machine

## v0.1.7 (2022-09-21)

* agent: allow more transitions in the request and claim state machines

## v0.1.6 (2022-09-19)

* frontend: added onboarding on desktop devices when MetaMask is not installed
* frontend: changed to dynamic wallet provider selection options based on device detection
* frontend: fixed transactions display inside the transfer history
* frontend: fixed failing transfers by adjusting logic for waiting on transaction receipts
* frontend: add automated config file generation process & yarn hooks for it
* frontend: added "go back" feature on selector view
* frontend: fixed other minor bugs
* docs: added a FAQ
* agent: allow more transitions when calling ignore() in claim state machine

## v0.1.5 (2022-09-06)

* agent: fix handling of L1 resolution events when syncing
* contracts: max request validity period has been set to 30 minutes
* deployments: updated mainnet deployment
* frontend: input validation logic added
* frontend: updated mainnet config
* frontend: fixed token amount abbreviations
* frontend: added tooltip for displaying exact token amount balance
* frontend: added "use max" feature on click of token amount balance
* frontend: fixed error message overflow
* frontend: fixed gap issue on transfer progress line

## v0.1.4 (2022-08-23)

* agent: fix incorrect log level handling
* relayer: fixed incorrect exception handling
* relayer: don't try to relay an already relayed message
* scripts: generate_account.py got a new required option, --password

## v0.1.3 (2022-08-05)

* agent: fix location of relayer binaries in the container image

## v0.1.2 (2022-08-05)

* agent: added support for specifying a configuration file
* agent: retry transactions in case of invalid nonces
* agent: reduce number of RPC calls by caching block data

## v0.1.1 (2022-07-07)

## v0.1.0 (2022-07-06)

* Initial release
