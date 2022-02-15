// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "./CrossDomainRestrictedCalls.sol";

contract ResolutionRegistry is CrossDomainRestrictedCalls {

    event RequestResolved(
        bytes32 requestHash,
        address resolvedClaimer
    );

    mapping(bytes32 => address) public eligibleClaimers;

    function resolveRequest(bytes32 requestHash, uint256 resolutionChainId, address eligibleClaimer)
        external restricted(resolutionChainId, msg.sender) {

        require(eligibleClaimers[requestHash] == address(0), "Resolution already recorded");
        eligibleClaimers[requestHash] = eligibleClaimer;

        emit RequestResolved(
            requestHash,
            eligibleClaimer
        );
    }
}
