// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

interface IProofSubmitter {
    function submitProof(
        address l1Resolver,
        bytes32 requestHash,
        uint256 sourceChainId,
        address eligibleClaimer
    ) external returns (bytes32);
}
