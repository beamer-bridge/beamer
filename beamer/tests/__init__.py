from ape.api.providers import Web3Provider


# Make ape do the call directly, instead of using chain_manager.isolate() to
# do a snapshot, make a transaction and then revert to the original chain state.
Web3Provider.send_call = Web3Provider._send_call  # type: ignore
