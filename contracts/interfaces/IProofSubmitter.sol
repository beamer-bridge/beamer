// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

interface IProofSubmitter {
    struct ProofReceipt {
        bytes32 fillId;
        bytes32 fillHash;
    }

    function submitProof(
        address l1Resolver,
        uint256 sourceChainId,
        bytes32 requestHash,
        address eligibleClaimer
    ) external returns (ProofReceipt memory);

    function submitNonFillProof(
        address l1Resolver,
        uint256 sourceChainId,
        bytes32 fillHash
    ) external;
}
