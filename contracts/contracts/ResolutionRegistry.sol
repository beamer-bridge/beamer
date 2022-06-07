// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "./CrossDomainRestrictedCalls.sol";
import "./BeamerUtils.sol";

contract ResolutionRegistry is CrossDomainRestrictedCalls {
    event RequestResolved(bytes32 requestHash, address filler, bytes32 fillId);

    event FillHashInvalidated(bytes32 fillHash);

    // mapping from requestHash to FillInfo
    mapping(bytes32 => BeamerUtils.FillInfo) public fillers;
    // mapping from fillHash to validity flag
    mapping(bytes32 => bool) public invalidFillHashes;

    function resolveRequest(
        bytes32 requestHash,
        bytes32 fillId,
        uint256 resolutionChainId,
        address filler
    ) external restricted(resolutionChainId, msg.sender) {
        require(
            fillers[requestHash].filler == address(0),
            "Resolution already recorded"
        );
        fillers[requestHash] = BeamerUtils.FillInfo(filler, fillId);
        // Revert fill hash invalidation, fill proofs outweigh an invalidation
        bytes32 fillHash = BeamerUtils.createFillHash(requestHash, fillId);
        invalidFillHashes[fillHash] = false;

        emit RequestResolved(requestHash, filler, fillId);
    }

    function invalidateFillHash(
        bytes32 requestHash,
        bytes32 fillId,
        uint256 resolutionChainId
    ) external restricted(resolutionChainId, msg.sender) {
        require(
            fillers[requestHash].filler == address(0),
            "Cannot invalidate resolved fillHashes"
        );
        bytes32 fillHash = BeamerUtils.createFillHash(requestHash, fillId);
        require(
            invalidFillHashes[fillHash] == false,
            "FillHash already invalidated"
        );

        invalidFillHashes[fillHash] = true;

        emit FillHashInvalidated(fillHash);
    }
}
