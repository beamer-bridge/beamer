// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "./CrossDomainRestrictedCalls.sol";
import "./BeamerUtils.sol";

/// The resolution registry.
///
/// This contract resides on the source L2 chain and is tasked with keeping track of results
/// of L1 resolution. In particular, it stores the information about known fills and fillers,
/// as well as fills that were marked invalid. This information is used by the :sol:contract:`RequestManager`
/// to resolve claims.
///
/// .. note::
///
///   This contract can only be called by the :sol:contract:`Resolver` contract, via a
///   chain-dependent messenger contract.
contract ResolutionRegistry is CrossDomainRestrictedCalls {
    /// Emitted when a request has been resolved via L1 resolution.
    ///
    /// .. seealso:: :sol:func:`resolveRequest`
    event RequestResolved(bytes32 requestId, address filler, bytes32 fillId);

    /// Emitted when a fill hash has been invalidated.
    ///
    /// .. seealso:: :sol:func:`invalidateFill`
    event FillHashInvalidated(bytes32 fillHash);

    /// Maps request IDs to fill infos.
    mapping(bytes32 => BeamerUtils.FillInfo) public fillers;

    /// The set of invalid fill hashes.
    mapping(bytes32 => bool) public invalidFillHashes;

    /// Mark the request identified by ``requestId`` as filled by ``filler``.
    ///
    /// .. note::
    ///
    ///     This function is callable only by the native L2 messenger contract,
    ///     which simply delivers the message sent from L1 by the
    ///     Beamer's L2 :sol:interface:`messenger <IMessenger>` contract.
    ///
    /// @param requestId The request ID.
    /// @param fillId The fill ID.
    /// @param resolutionChainId The resolution (L1) chain ID.
    /// @param filler The address that filled the request.
    function resolveRequest(
        bytes32 requestId,
        bytes32 fillId,
        uint256 resolutionChainId,
        address filler
    ) external restricted(resolutionChainId, msg.sender) {
        require(
            fillers[requestId].filler == address(0),
            "Resolution already recorded"
        );
        fillers[requestId] = BeamerUtils.FillInfo(filler, fillId);
        // Revert fill hash invalidation, fill proofs outweigh an invalidation
        bytes32 fillHash = BeamerUtils.createFillHash(requestId, fillId);
        invalidFillHashes[fillHash] = false;

        emit RequestResolved(requestId, filler, fillId);
    }

    /// Mark the fill identified by ``fillId`` as invalid.
    ///
    /// .. note::
    ///
    ///     This function is callable only by the native L2 messenger contract,
    ///     which simply delivers the message sent from L1 by the
    ///     Beamer's L2 :sol:interface:`messenger <IMessenger>` contract.
    ///
    /// @param requestId The request ID.
    /// @param fillId The fill ID.
    /// @param resolutionChainId The resolution (L1) chain ID.
    function invalidateFill(
        bytes32 requestId,
        bytes32 fillId,
        uint256 resolutionChainId
    ) external restricted(resolutionChainId, msg.sender) {
        require(
            fillers[requestId].filler == address(0),
            "Cannot invalidate resolved fillHashes"
        );
        bytes32 fillHash = BeamerUtils.createFillHash(requestId, fillId);
        require(
            invalidFillHashes[fillHash] == false,
            "FillHash already invalidated"
        );

        invalidFillHashes[fillHash] = true;

        emit FillHashInvalidated(fillHash);
    }
}
