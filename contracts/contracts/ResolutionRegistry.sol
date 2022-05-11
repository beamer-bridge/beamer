// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "./CrossDomainRestrictedCalls.sol";

contract ResolutionRegistry is CrossDomainRestrictedCalls {
    event RequestResolved(uint256 requestId, bytes32 fillHash, address filler);

    event FillHashInvalidated(uint256 requestId, bytes32 fillHash);

    // mapping from fillHash to filler
    mapping(bytes32 => address) public fillers;
    // mapping from fillHash to validity flag
    mapping(bytes32 => bool) public invalidFillHashes;

    function resolveRequest(
        uint256 requestId,
        bytes32 fillHash,
        uint256 resolutionChainId,
        address filler
    ) external restricted(resolutionChainId, msg.sender) {
        require(fillers[fillHash] == address(0), "Resolution already recorded");
        fillers[fillHash] = filler;

        emit RequestResolved(requestId, fillHash, filler);
    }

    function invalidateFillHash(
        uint256 requestId,
        bytes32 fillHash,
        uint256 resolutionChainId
    ) external restricted(resolutionChainId, msg.sender) {
        require(
            invalidFillHashes[fillHash] == false,
            "FillHash already invalidated"
        );
        invalidFillHashes[fillHash] = true;

        emit FillHashInvalidated(requestId, fillHash);
    }
}
