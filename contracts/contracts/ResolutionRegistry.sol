// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "./CrossDomainRestrictedCalls.sol";

contract ResolutionRegistry is CrossDomainRestrictedCalls {

    event RequestResolved(
        bytes32 fillHash,
        address filler
    );

    // mapping from fillHash to filler
    mapping(bytes32 => address) public fillers;

    function resolveRequest(bytes32 fillHash, uint256 resolutionChainId, address filler)
        external restricted(resolutionChainId, msg.sender) {

        require(fillers[fillHash] == address(0), "Resolution already recorded");
        fillers[fillHash] = filler;

        emit RequestResolved(
            fillHash,
            filler
        );
    }
}
