// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "../../../interfaces/IMessenger.sol";

import "../../RestrictedCalls.sol";
import "./ICrossDomainMessenger.sol";
import "./Lib_PredeployAddresses.sol";

abstract contract OptimismMessengerBase is IMessenger, RestrictedCalls {
    ICrossDomainMessenger public messenger;

    function originalSender() external view returns (address) {
        return messenger.xDomainMessageSender();
    }

    function nativeMessenger() external view returns (address) {
        return address(messenger);
    }

    function sendMessage(
        address target,
        bytes calldata message,
        uint32 gasLimit
    ) external restricted(block.chainid, msg.sender) {
        messenger.sendMessage(target, message, gasLimit);
    }
}

contract OptimismL1Messenger is OptimismMessengerBase {
    constructor(address messenger_) {
        messenger = ICrossDomainMessenger(messenger_);
    }
}

contract OptimismL2Messenger is OptimismMessengerBase {
    constructor() {
        messenger = ICrossDomainMessenger(
            Lib_PredeployAddresses.L2_CROSS_DOMAIN_MESSENGER
        );
    }
}
