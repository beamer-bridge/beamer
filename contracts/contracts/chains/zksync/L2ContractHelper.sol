// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IL2Messenger {
    function sendToL1(bytes memory _message) external returns (bytes32);
}
