// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "OpenZeppelin/openzeppelin-contracts@4.5.0/contracts/token/ERC20/IERC20.sol";
import "OpenZeppelin/openzeppelin-contracts@4.5.0/contracts/token/ERC20/utils/SafeERC20.sol";
import "OpenZeppelin/openzeppelin-contracts@4.5.0/contracts/access/Ownable.sol";
import "./LpWhitelist.sol";
import "../interfaces/IProofSubmitter.sol";
import "./BeamerUtils.sol";

/// The fill manager.
///
/// This contract is responsible for keeping track of filled requests. In addition to allowing
/// agents to (eventually) prove that they filled requests, it also allows anyone to invalidate
/// a claim that a request was filled.
///
/// It is the only contract that agents need to interact with on the target chain.
contract FillManager is Ownable, LpWhitelist {
    using SafeERC20 for IERC20;

    /// Emitted when a request has been filled.
    ///
    /// .. seealso:: :sol:func:`fillRequest`
    event RequestFilled(
        bytes32 indexed requestId,
        bytes32 fillId,
        uint256 indexed sourceChainId,
        address indexed targetTokenAddress,
        address filler,
        uint256 amount
    );

    /// Emitted when a fill hash has been invalidated.
    ///
    /// .. seealso:: :sol:func:`invalidateFill`
    event HashInvalidated(
        bytes32 indexed requestId,
        bytes32 indexed fillId,
        bytes32 indexed fillHash
    );

    /// The L1 :sol:contract:`Resolver` contract to be used for L1 resolution.
    address public l1Resolver;

    /// The proof submitter contract to be used for submitting L1 proofs.
    ///
    /// The specific implementation of the :sol:interface:`IProofSubmitter` interface
    /// is chain-dependent.
    IProofSubmitter public proofSubmitter;

    /// Maps request IDs to fill hashes.
    mapping(bytes32 => bytes32) public fills;

    /// Constructor.
    ///
    /// @param _l1Resolver The L1 resolver contract.
    /// @param _proofSubmitter The proof submitter.
    constructor(address _l1Resolver, address _proofSubmitter) {
        l1Resolver = _l1Resolver;
        proofSubmitter = IProofSubmitter(_proofSubmitter);
    }

    /// Fill the specified request.
    ///
    /// The caller must have approved at least ``amount`` tokens for :sol:contract:`FillManager`
    /// with the ERC20 token contract at ``targetTokenAddress``. The tokens will be immediately
    /// sent to ``targetReceiverAddress`` and a fill proof will be generated, which can later
    /// be used to trigger L1 resolution, if needed.
    ///
    /// @param sourceChainId The source chain ID.
    /// @param targetTokenAddress Address of the token contract on the target chain.
    /// @param targetReceiverAddress Recipient address on the target chain.
    /// @param amount Amount of tokens to transfer. Does not include fees.
    /// @param nonce The nonce used to create the request ID.
    /// @return The fill ID.
    function fillRequest(
        uint256 sourceChainId,
        address targetTokenAddress,
        address targetReceiverAddress,
        uint256 amount,
        uint256 nonce
    ) external onlyWhitelist returns (bytes32) {
        bytes32 requestId = BeamerUtils.createRequestId(
            sourceChainId,
            block.chainid,
            targetTokenAddress,
            targetReceiverAddress,
            amount,
            nonce
        );

        require(fills[requestId] == bytes32(0), "Already filled");

        IERC20 token = IERC20(targetTokenAddress);
        token.safeTransferFrom(msg.sender, targetReceiverAddress, amount);

        IProofSubmitter.ProofReceipt memory proofReceipt = proofSubmitter
            .submitProof(l1Resolver, sourceChainId, requestId, msg.sender);
        require(proofReceipt.fillId != 0, "Submitting proof data failed");

        fills[requestId] = proofReceipt.fillHash;

        emit RequestFilled(
            requestId,
            proofReceipt.fillId,
            sourceChainId,
            targetTokenAddress,
            msg.sender,
            amount
        );

        return proofReceipt.fillId;
    }

    /// Invalidate the specified fill.
    ///
    /// In cases that a claim has been made on the source chain, but without a corresponding fill
    /// actually happening on the target chain, anyone can call this function to mark the fill
    /// as invalid. This is typically followed by a challenge game on the source chain, which
    /// the dishonest claimer is guaranteed to lose as soon as the information about the invalid
    /// fill (so called "non-fill proof") is propagated to the source chain via L1 resolution.
    ///
    /// @param requestId The request ID.
    /// @param fillId The fill ID.
    /// @param sourceChainId The source chain ID.
    function invalidateFill(
        bytes32 requestId,
        bytes32 fillId,
        uint256 sourceChainId
    ) external {
        bytes32 fillHash = BeamerUtils.createFillHash(requestId, fillId);
        require(fills[requestId] != fillHash, "Fill hash valid");
        proofSubmitter.submitNonFillProof(
            l1Resolver,
            sourceChainId,
            requestId,
            fillId
        );
        emit HashInvalidated(requestId, fillId, fillHash);
    }
}
