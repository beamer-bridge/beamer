// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "../interfaces/ICrossDomainMessenger.sol";

contract TestCrossDomainMessenger is ICrossDomainMessenger {
    address public lastSender;
    bool public forwardMessages;

    function xDomainMessageSender() external view returns (address) {
        return lastSender;
    }

    function sendMessage(
        address _target,
        bytes calldata _message,
        uint32 _gasLimit
    ) external {
        if (forwardMessages) {
            lastSender = msg.sender;
            (bool success, ) = _target.call{gas: _gasLimit}(_message);
            require(success, "tx failed");
        }
    }

    function setLastSender(address sender) external {
        lastSender = sender;
    }

    function setForwardState(bool _forward) external {
        forwardMessages = _forward;
    }
}
