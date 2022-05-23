// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

interface IMessenger {
    function sendMessage(
        address target,
        bytes calldata message,
        uint32 gasLimit
    ) external;

    function originalSender() external view returns (address);

    function nativeMessenger() external view returns (address);
}
