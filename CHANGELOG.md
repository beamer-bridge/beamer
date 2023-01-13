# Changelog

## v1.0.1 (2023-01-13)

* docker: fix the issue where the relayer could not be run due to missing C++ runtime lib

## v1.0.0 (2023-01-13)

* docker: reduced beamer-agent container image size from 2.41GB to 254MB
* deployments: updated mainnet deployment
* contracts: major simplifications, fixes and optimizations
* contracts: audit-related fixes
* contracts: merge resolution registry into the request manager
* contracts: add support for Arbitrum
* contracts: allow withdrawals on behalf of others
* contracts: allow claims on behalf of others
* contracts: allow claims for a limited time after request expiry
* contracts: set minValidityPeriod to 30 minutes
* contracts: set maxValidityPeriod to 48 hours
* contracts: add multi-token support
* agent: add unsafe-fill-time option
* agent: raise the minimum Python version to 3.10
* docs: lots of updates to make the content current
* frontend: tons of bug fixes
* frontend: improved input form validation
* frontend: improved token amount input field - enforcing numeric input
* frontend: raised unit-test coverage to 98.5%
* frontend: clean-up & refactor large part of the codebase 🧹
* frontend: integrated Goerli testnet (Goerli Boba, Goerli Optimism, Goerli Arbitrum)
* frontend: integrate matomo tracking tool
* frontend: add wallet disconnect feature
* frontend: automated the app config generation & attached as yarn post-install hooks
* frontend: improve mobile/desktop wallet connection flows
* frontend: integrate chatbot
* frontend: add support for v1 contracts
* frontend: integrate Arbitrum One
* frontend: lots of small UI improvements
* relayer: redesign relayer architecture for multi rollup support
* relayer: implement Boba relayer
* relayer: implement Arbitrum relayer
* relayer: optimize Optimism relayer

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
