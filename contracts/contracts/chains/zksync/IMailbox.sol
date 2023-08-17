// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

struct L2Message {
    uint16 txNumberInBlock;
    address sender;
    bytes data;
}

interface IMailbox {
    function proveL2MessageInclusion(
        uint256 _blockNumber,
        uint256 _index,
        L2Message calldata _message,
        bytes32[] calldata _proof
    ) external view returns (bool);
}
