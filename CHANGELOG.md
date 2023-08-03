# Changelog

## v2.5.2 (2023-08-03)

* frontend: switch to a differernt RPC for Polygon zkEVM
* frontend: increase request validity period to 24h
* agent: emit a log entry when an OP proof is successful
* agent: take the fill mutex before doing anything else when filling

## v2.5.1 (2023-07-31)

* deployments: add PGN and Base artifacts
* agent: support PGN and Base chains

## v2.5.0 (2023-07-28)

* beamer: config: don't add duplicate entries to whitelists
* beamer: fix handling of quantities in JSON-RPC responses
* frontend: implement subsidized transfers
* frontend: change twitter share text
* frontend: enable polygon zkevm
* frontend: minor bug fixes
* frontend: add support for Base (still not enabled)
* relayer: add support for Base

## v2.4.0 (2023-07-10)
* ci: Build the image for publish
* contracts: Add FeeSub contract
* beamer: `config` command: Ensure chain IDs from config and deployment match
* relayer: Recover L1 transaction hash in Arbitrum relayer
* relayer: Improved architecture and typing
* relayer: Return proof timestamp from Optimism relayer to agent
* frontend: Detect and provide better error messages when token allowance is too low


## v2.3.0 (2023-06-30)
* ci: add new e2e test to test relayer fallback for OP
* agent: adapt agent to use new deployment artifacts
* docs: update docs regarding new deployment artifacts
* beamer: introduce new beamer subcommand `write` for `config` command
* docs: update docs regarding `config` commands
* agent: add min-source-balance to agent config
* docs: update docs regarding `min-source-balance` config
* beamer: add support for USDT & WETH
* beamer: improved beamer `config read`
* ci: optimized ci workflows
* agent: calculate OP finality period correctly by using prove timestamp
* frontend: add support for Polygon zkEVM (mainnet still not enabled)
* frontend: tokens/chains visibility can now be controlled easily
* frontend: fix minor bugs
* frontend: migrate to WalletConnect v2
* frontend: users can now fully disconnect from the connected wallets (session removed)
* frontend: update wallet provider SDKs
* docker: fix flaky polygon e2e test
* relayer: prevent submission of failing L1 resolutions


## v2.2.1 (2023-06-20)
* relayer: Update Arbitrum SDK to 3.1.4
* relayer: Update Optimism SDK to 2.1.0
* ci: fix flaky end-to-end tests


## v2.2.0 (2023-06-14)

* agent: Restructure common modules to top level directory
* agent: Add support for Optimism Bedrock relayer calls
* beamer: Introduce new beamer commands `deploy-base` and `deploy`
* beamer: Introduce new deployment artifacts structure
* beamer: Introduce new beamer command `config` with subcommand `read`
* frontend/relayer: Release npm packages containing the deployment artifacts via CI
* contracts: Implement Polygon zkEVM messenger
* frontend: Support for Safe contract wallets 
* frontend: Transfers get continued even if user closes app before finalizing the two transactions
* frontend: Notification when transfer was completed and share via Twitter
* frontend: Minor bug fixes
* relayer: Integrate relayer in Optimism E2E test
* relayer: Implement PolygonZKEvm relayer service
* relayer: Improve logging
* relayer: Add support for Optimism Bedrock
* relayer: Extend relayer CLI to support multiple subcommands
* relayer: Bug fixes
* scripts: Introduce generate_abi script

## v2.1.0 (2023-04-27)

* agent: only continue challenge after message is finalized
* agent: call relayer through process_claims and remove InitiateL1Resolution event
* agent: halt event processor if connection error occurs on RPC
* frontend: temporarily disabled chat feedback
* frontend: minor bug fixes
* docs: update fee section

## v2.0.0 (2023-04-12)

* change directory structure and add multiple sub commands to the beamer command (i.e. beamer agent ...)
* contracts: implement Ethereum messengers in order to add Ethereum as a chain
* contracts: add automatic withdrawal in ArbitrumL1Messenger
* contracts: update to Solidity 0.8.19
* contracts: implement new minLpFee calculation
* agent: support multiple chain pairs in one process
* agent: predefine allowance value per token per chain
* agent: deprecate --source-chain and --target-chain options
* agent: introduce poll period in agent config
* agent: introduce confirmation blocks in agent config to wait for confirmation of events
* agent: Use dynamic fee transactions on ETH2 chains (type 2)
* relayer: relay to and from Ethereum
* relayer: Handle redeem on Arbitrum even if message was already relayed
* health-check: introduce health check script for agents
* health-check: add monitoring for DAI
* scripts: validate deployment config with apischema
* dependencies: switch from brownie to ape
* docs: add section about beamer commands
* docs: add section containing latest mainnet addresses
* frontend: add a checkbox to approve the maximum token allowance
* frontend: add support for any injected provider
* frontend: add DAI token support
* frontend: add support for bridging from/to Ethereum mainnet
* frontend: plenty of bug fixes

## v1.0.3 (2023-03-09)

* agent: properly handle HTTP 413 errors (notably used by QuickNode RPC)

## v1.0.2 (2023-02-17)

* docs: added a section on updating to a new agent version
* agent: create only one relayer process per L1 resolution/invalidation
* agent: introduce a rate limiter to handle cases where the agent exceeds RPC's rate limits
* agent: when filling a request, only call ERC20 token approve if allowance is
         insufficient to fill the request
* frontend: added real-time claim count watcher
* frontend: automatic enable/disable of withdraw button based on claim counts
* frontend: temporarily remove boba from chain options
* frontend: handle reverted transactions
* frontend: added Arbitrum notification banner
* frontend: fixed token allowance race conditions when having multiple transfers active
* frontend: transfer submission disabled (with notification) until tokens are spent
* frontend: UI fixes/improvements
* frontend: fix unit test code coverage
* frontend: add matomo tracking consent popup
* frontend: add build version inside footer
* frontend: add social media links inside footer
* frontend: fix MetaMask wallet disconnection on network change
* frontend: integrate Coinbase wallet provider
* frontend: plenty of bug fixes
* relayer: reduced max message length used to calculate deposit amount for Arbitrum
* relayer: add support for using custom networks inside Arbitrum relayer service

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
