// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "../interfaces/ICrossDomainMessenger.sol";

contract TestCrossDomainMessenger is ICrossDomainMessenger {
    address lastSender;

    function xDomainMessageSender() external view returns (address) {
        return lastSender;
    }

    function sendMessage(
        address _target,
        bytes calldata _message,
        uint32 _gasLimit
    ) external {
        lastSender = msg.sender;
        (bool success, ) = _target.call{gas: _gasLimit}(_message);
        require(success, "tx failed");
    }
}
