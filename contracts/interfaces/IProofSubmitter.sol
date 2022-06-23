// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

/// The proof submitter interface.
///
/// Essential for the L1 resolution process, implementations are expected
/// to construct fill and non-fill proofs, which are then sent to the target
/// chain's messenger contract.
interface IProofSubmitter {
    struct ProofReceipt {
        bytes32 fillId;
        bytes32 fillHash;
    }

    /// Submit a fill proof.
    ///
    /// @param l1Resolver The L1 :sol:contract:`Resolver`.
    /// @param sourceChainId The source chain ID.
    /// @param requestHash The request hash.
    /// @param eligibleClaimer The filler.
    /// @return The proof receipt.
    function submitProof(
        address l1Resolver,
        uint256 sourceChainId,
        bytes32 requestHash,
        address eligibleClaimer
    ) external returns (ProofReceipt memory);

    /// Submit a non-fill proof.
    ///
    /// @param l1Resolver The L1 :sol:contract:`Resolver`.
    /// @param sourceChainId The source chain ID.
    /// @param requestHash The request hash.
    /// @param fillId The fill ID.
    function submitNonFillProof(
        address l1Resolver,
        uint256 sourceChainId,
        bytes32 requestHash,
        bytes32 fillId
    ) external;
}
