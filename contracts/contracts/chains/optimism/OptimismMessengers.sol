// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "../../../interfaces/IMessenger.sol";

import "../../RestrictedCalls.sol";
import "OpenZeppelin/openzeppelin-contracts@4.7.3/contracts/vendor/optimism/ICrossDomainMessenger.sol";
import "./Lib_PredeployAddresses.sol";

abstract contract OptimismMessengerBase is IMessenger, RestrictedCalls {
    uint32 private constant MESSAGE_GAS_LIMIT = 1_000_000;

    ICrossDomainMessenger public messenger;

    function originalSender() external view returns (address) {
        return messenger.xDomainMessageSender();
    }

    function nativeMessenger() external view returns (address) {
        return address(messenger);
    }

    function sendMessage(address target, bytes calldata message)
        external
        restricted(block.chainid, msg.sender)
    {
        messenger.sendMessage(target, message, MESSAGE_GAS_LIMIT);
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
