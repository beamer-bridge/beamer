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
    struct ResolutionInfos {
        address resolutionRegistry;
        address messenger;
    }

    /// Emitted when a fill or a non-fill proof is received and sent to the resolution registry.
    ///
    /// .. note:: In case of a non-fill proof, the ``filler`` will be zero.
    event Resolution(
        uint256 sourceChainId,
        uint256 fillChainId,
        bytes32 requestHash,
        address filler,
        bytes32 fillId
    );

    /// Maps source chain IDs to resolution infos.
    mapping(uint256 => ResolutionInfos) public resolutionInfos;

    /// Resolve the specified request.
    ///
    /// This marks the request identified by ``requestHash`` as filled by ``filler``.
    /// Information about the fill will be sent to the source chain's :sol:contract:`ResolutionRegistry`,
    /// using the messenger responsible for the source chain.
    ///
    /// .. note::
    ///
    ///     This function is callable only by the native L1 messenger contract,
    ///     which simply delivers the message sent from the target chain by the
    ///     Beamer's L2 :sol:interface:`messenger <IMessenger>` contract.
    ///
    /// @param requestHash The request hash.
    /// @param fillId The fill ID.
    /// @param fillChainId The fill (target) chain ID.
    /// @param sourceChainId The source chain ID.
    /// @param filler The address that filled the request.
    function resolve(
        bytes32 requestHash,
        bytes32 fillId,
        uint256 fillChainId,
        uint256 sourceChainId,
        address filler
    ) external restricted(fillChainId, msg.sender) {
        ResolutionInfos storage info = resolutionInfos[sourceChainId];
        require(
            info.resolutionRegistry != address(0),
            "No registry available for source chain"
        );
        require(
            info.messenger != address(0),
            "No messenger available for source chain"
        );

        IMessenger messenger = IMessenger(info.messenger);
        messenger.sendMessage(
            info.resolutionRegistry,
            abi.encodeCall(
                ResolutionRegistry.resolveRequest,
                (requestHash, fillId, block.chainid, filler)
            ),
            1_000_000
        );

        emit Resolution(
            sourceChainId,
            fillChainId,
            requestHash,
            filler,
            fillId
        );
    }

    /// Mark the fill as invalid.
    ///
    /// Callable only by the proof submitter contract via a messenger, this
    /// marks the fill as invalid. Information about the invalid fill will be
    /// sent to the source chain's :sol:contract:`ResolutionRegistry`,
    /// using the messenger responsible for transferring messages to the source chain.
    ///
    /// .. note::
    ///
    ///     This function is callable only by the native L1 messenger contract,
    ///     which simply delivers the message sent from the target chain by the
    ///     Beamer's L2 :sol:interface:`messenger <IMessenger>` contract.
    ///
    /// @param requestHash The request hash.
    /// @param fillId The fill ID.
    /// @param fillChainId The fill (target) chain ID.
    /// @param sourceChainId The source chain ID.
    function resolveNonFill(
        bytes32 requestHash,
        bytes32 fillId,
        uint256 fillChainId,
        uint256 sourceChainId
    ) external restricted(fillChainId, msg.sender) {
        ResolutionInfos storage info = resolutionInfos[sourceChainId];
        require(
            info.resolutionRegistry != address(0),
            "No registry available for source chain"
        );
        require(
            info.messenger != address(0),
            "No messenger available for source chain"
        );

        IMessenger messenger = IMessenger(info.messenger);
        messenger.sendMessage(
            info.resolutionRegistry,
            abi.encodeCall(
                ResolutionRegistry.invalidateFillHash,
                (requestHash, fillId, block.chainid)
            ),
            1_000_000
        );

        emit Resolution(
            sourceChainId,
            fillChainId,
            requestHash,
            address(0),
            fillId
        );
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
        resolutionInfos[chainId] = ResolutionInfos(
            resolutionRegistry,
            messenger
        );
    }
}
