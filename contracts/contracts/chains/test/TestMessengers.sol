// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "../../../interfaces/IMessenger.sol";

import "../../RestrictedCalls.sol";

contract TestMessengerBase is IMessenger, RestrictedCalls {
    uint32 private constant MESSAGE_GAS_LIMIT = 1_000_000;

    address public lastSender;
    bool public forwardMessages;

    function originalSender() external view returns (address) {
        return lastSender;
    }

    function sendMessage(address target, bytes calldata message)
        external
        restricted(block.chainid, msg.sender)
    {
        if (forwardMessages) {
            lastSender = msg.sender;
            (bool success, ) = target.call{gas: MESSAGE_GAS_LIMIT}(message);
            require(success, "sendMessage: tx failed");
        }
    }

    function setLastSender(address sender) external {
        lastSender = sender;
    }

    function setForwardState(bool forward) external {
        forwardMessages = forward;
    }

    function nativeMessenger() external view returns (address) {
        return address(this);
    }
}

// solhint-disable-next-line no-empty-blocks
contract TestL1Messenger is TestMessengerBase {

}

// solhint-disable-next-line no-empty-blocks
contract TestL2Messenger is TestMessengerBase {

}
