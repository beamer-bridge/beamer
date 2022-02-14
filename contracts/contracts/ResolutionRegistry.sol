// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "./RestrictedCalls.sol";

contract ResolutionRegistry is RestrictedCalls {

    event RequestResolved(
        bytes32 requestHash,
        address resolvedClaimer
    );

    mapping(bytes32 => address) public eligibleClaimers;

    function resolveRequest(bytes32 requestHash, address eligibleClaimer)
        external restricted(block.chainid, msg.sender) {

        require(eligibleClaimers[requestHash] == address(0), "Resolution already recorded");
        eligibleClaimers[requestHash] = eligibleClaimer;

        emit RequestResolved(
            requestHash,
            eligibleClaimer
        );
    }
}
