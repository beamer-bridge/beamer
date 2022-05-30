// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "./CrossDomainRestrictedCalls.sol";

contract ResolutionRegistry is CrossDomainRestrictedCalls {
    event RequestResolved(bytes32 fillHash, address filler);

    event FillHashInvalidated(bytes32 fillHash);

    // mapping from fillHash to filler
    mapping(bytes32 => address) public fillers;
    // mapping from fillHash to validity flag
    mapping(bytes32 => bool) public invalidFillHashes;

    function resolveRequest(
        bytes32 fillHash,
        uint256 resolutionChainId,
        address filler
    ) external restricted(resolutionChainId, msg.sender) {
        require(fillers[fillHash] == address(0), "Resolution already recorded");
        fillers[fillHash] = filler;
        // Revert fill hash invalidation, fill proofs outweigh an invalidation
        invalidFillHashes[fillHash] = false;

        emit RequestResolved(fillHash, filler);
    }

    function invalidateFillHash(bytes32 fillHash, uint256 resolutionChainId)
        external
        restricted(resolutionChainId, msg.sender)
    {
        require(
            fillers[fillHash] == address(0),
            "Cannot invalidate resolved fillHashes"
        );
        require(
            invalidFillHashes[fillHash] == false,
            "FillHash already invalidated"
        );

        invalidFillHashes[fillHash] = true;

        emit FillHashInvalidated(fillHash);
    }
}
