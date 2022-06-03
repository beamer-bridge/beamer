// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "OpenZeppelin/openzeppelin-contracts@4.5.0/contracts/access/Ownable.sol";
import "../interfaces/IMessenger.sol";
import "./ResolutionRegistry.sol";
import "./CrossDomainRestrictedCalls.sol";

contract Resolver is Ownable, CrossDomainRestrictedCalls {
    struct ResolutionInfos {
        address resolutionRegistry;
        address messenger;
    }

    event Resolution(
        uint256 sourceChainId,
        uint256 fillChainId,
        bytes32 requestHash,
        address filler,
        bytes32 fillId
    );

    mapping(uint256 => ResolutionInfos) public resolutionInfos;

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

    function resolveNonFill(
        bytes32 fillHash,
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
                (fillHash, block.chainid)
            ),
            1_000_000
        );

        emit Resolution(sourceChainId, fillChainId, fillHash, address(0));
    }

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
