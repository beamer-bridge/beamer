---
name: Add a new token
about: Request to add support for a new token.
title: ''
labels: ''
assignees: ''
---

Add support for token :x:

Initial values for
- transfer limit:   :x:
- ETH in token:   :x:

### To do:

- [ ] Update [#beamer-bridge/run-your-own-agent](https://github.com/beamer-bridge/run-your-own-agent/) config file(s) with new token data
       (token contract addresses from this step can be used in later steps for configuration)
- [ ] Add new token to the fee calculation sheet
- [ ] Add token to contracts on all supported chains
- [ ] Inform agents about the need to provide new token liquidity and the necessary agent config changes
- [ ] Add new token support to the frontend, but do not deploy the new frontend yet
- [ ] Deploy new frontend once liquidity becomes available
