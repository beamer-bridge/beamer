// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "./RestrictedCalls.sol";

contract ResolutionRegistry is RestrictedCalls {

    event RequestResolved(
        uint256 requestId,
        address resolvedClaimer
    );

    mapping(uint256 => address) public eligibleClaimers;

    function resolveRequest(uint256 requestId, address eligibleClaimer)
        external restricted(block.chainid, msg.sender) {

        require(eligibleClaimers[requestId] == address(0), "Resolution already recorded");
        eligibleClaimers[requestId] = eligibleClaimer;

        emit RequestResolved(
            requestId,
            eligibleClaimer
        );
    }
}
