// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;


contract ResolutionRegistry {

    event RequestResolved(
        uint256 requestId,
        address resolvedClaimer
    );

    mapping(uint256 => address) public eligibleClaimers;

    function resolveRequest(uint256 requestId, address eligibleClaimer) external {
        // FIXME: we need to check that the tx sender is the L1 resolver contract

        require(eligibleClaimers[requestId] == address(0), "Resolution already recorded");
        eligibleClaimers[requestId] = eligibleClaimer;

        emit RequestResolved(
            requestId,
            eligibleClaimer
        );
    }
}
