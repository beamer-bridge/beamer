// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../../../interfaces/IMessenger.sol";
import "../../RestrictedCalls.sol";
import "zksync/AddressAliasHelper.sol";
import "zksync/L2ContractHelper.sol";

address constant L2_TO_L1_MESSENGER_SYSTEM_CONTRACT_ADDR = address(0x8008);

contract ZkSyncL2Messenger is IMessenger, RestrictedCalls {
    function callAllowed(
        address caller,
        address courier
    ) external view returns (bool) {
        return courier ==
            AddressAliasHelper.applyL1ToL2Alias(caller);
    }

    function sendMessage(
        address,
        bytes calldata message
    ) external restricted(block.chainid) {
        IL2Messenger messenger = IL2Messenger(L2_TO_L1_MESSENGER_SYSTEM_CONTRACT_ADDR);
        messenger.sendToL1(message);
    }
}
