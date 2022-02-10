// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "./CrossDomainRestrictedCalls.sol";

struct ProvedFill {
    address filler;
    uint256 fillId;
}

contract ResolutionRegistry is CrossDomainRestrictedCalls {

    event RequestResolved(
        bytes32 requestHash,
        uint256 fillId,
        address resolvedClaimer
    );

    // mapping from requestHash to (filler, fillId)
    mapping(bytes32 => ProvedFill) public provedFills;

    function resolveRequest(bytes32 requestHash, uint256 fillId, uint256 resolutionChainId, address filler)
        external restricted(resolutionChainId, msg.sender) {

        require(provedFills[requestHash].filler == address(0), "Resolution already recorded");
        provedFills[requestHash] = ProvedFill(filler, fillId);

        emit RequestResolved(
            requestHash,
            fillId,
            filler
        );
    }
}
