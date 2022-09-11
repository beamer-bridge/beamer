// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "OpenZeppelin/openzeppelin-contracts@4.5.0/contracts/access/Ownable.sol";
import "../interfaces/IMessenger.sol";
import "./ResolutionRegistry.sol";
import "./CrossDomainRestrictedCalls.sol";

/// The resolver.
///
/// This contract resides on the L1 chain and is tasked with receiving the
/// fill or non-fill proofs from the target L2 chain and forwarding them to
/// the :sol:contract:`ResolutionRegistry` on the source L2 chain.
contract Resolver is Ownable, CrossDomainRestrictedCalls {
    struct SourceChainInfo {
        address resolutionRegistry;
        address messenger;
    }

    /// Emitted when a fill or a non-fill proof is received and sent to the resolution registry.
    ///
    /// .. note:: In case of a non-fill proof, the ``filler`` will be zero.
    event Resolution(
        uint256 sourceChainId,
        uint256 fillChainId,
        bytes32 requestId,
        address filler,
        bytes32 fillId
    );

    /// Maps source chain IDs to source chain infos.
    mapping(uint256 => SourceChainInfo) public sourceChainInfos;

    /// Resolve the specified request.
    ///
    /// This marks the request identified by ``requestId`` as filled by ``filler``.
    /// If the ``filler`` is zero, the fill be marked invalid.
    ///
    /// Information about the fill will be sent to the source chain's :sol:contract:`ResolutionRegistry`,
    /// using the messenger responsible for the source chain.
    ///
    /// .. note::
    ///
    ///     This function is callable only by the native L1 messenger contract,
    ///     which simply delivers the message sent from the target chain by the
    ///     Beamer's L2 :sol:interface:`messenger <IMessenger>` contract.
    ///
    /// @param requestId The request ID.
    /// @param fillId The fill ID.
    /// @param fillChainId The fill (target) chain ID.
    /// @param sourceChainId The source chain ID.
    /// @param filler The address that filled the request, or zero to invalidate the fill.
    function resolve(
        bytes32 requestId,
        bytes32 fillId,
        uint256 fillChainId,
        uint256 sourceChainId,
        address filler
    ) external restricted(fillChainId, msg.sender) {
        SourceChainInfo storage info = sourceChainInfos[sourceChainId];
        require(
            info.resolutionRegistry != address(0),
            "No registry available for source chain"
        );
        require(
            info.messenger != address(0),
            "No messenger available for source chain"
        );

        bytes memory message;

        if (filler == address(0)) {
            message = abi.encodeCall(
                ResolutionRegistry.invalidateFill,
                (requestId, fillId, block.chainid)
            );
        } else {
            message = abi.encodeCall(
                ResolutionRegistry.resolveRequest,
                (requestId, fillId, block.chainid, filler)
            );
        }

        IMessenger messenger = IMessenger(info.messenger);
        messenger.sendMessage(info.resolutionRegistry, message, 1_000_000);

        emit Resolution(sourceChainId, fillChainId, requestId, filler, fillId);
    }

    /// Add a resolution registry.
    ///
    /// In order to be able to send messages to the :sol:contract:`ResolutionRegistry`,
    /// the resolver contract needs to know the address of the registry on the source
    /// chain, as well as the address of the messenger contract responsible for
    /// transferring messages to the L2 chain.
    ///
    /// .. note:: This function can only be called by the contract owner.
    ///
    /// @param chainId The source L2 chain ID.
    /// @param resolutionRegistry The resolution registry.
    /// @param messenger The messenger contract responsible for chain ``chainId``.
    ///                  Must implement :sol:interface:`IMessenger`.
    function addRegistry(
        uint256 chainId,
        address resolutionRegistry,
        address messenger
    ) external onlyOwner {
        sourceChainInfos[chainId] = SourceChainInfo(
            resolutionRegistry,
            messenger
        );
    }
}
