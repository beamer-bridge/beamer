// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;


contract ResolveRegistry{

    event RequestResolved(
        uint256 requestId,
        address resolvedClaimer
    );

    mapping(uint256 => address) eligibleClaimers;

    function resolveRequest(uint256 requestId, address eligibleClaimer) external {

        require(eligibleClaimers[requestId] == address(0));
        eligibleClaimers[requestId] = eligibleClaimer;
        emit RequestResolved(
            requestId,
            eligibleClaimer
        );
    }

}