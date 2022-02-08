// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "../interfaces/ICrossDomainMessenger.sol";
import "./RestrictedCalls.sol";

contract TestCrossDomainMessenger is ICrossDomainMessenger, RestrictedCalls {
    address lastSender;
    bool forwardMessages;

    function xDomainMessageSender() external view returns (address) {
        return lastSender;
    }

    function sendMessage(
        address _target,
        bytes calldata _message,
        uint32 _gasLimit
    ) external restricted(block.chainid, msg.sender) {

        if (forwardMessages) {
            lastSender = msg.sender;
            (bool success, ) = _target.call{gas: _gasLimit}(_message);
            require(success, "tx failed");
        }
    }

    function setForwardState(bool _forward) external {
        forwardMessages = _forward;
    }
}
