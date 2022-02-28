// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "OpenZeppelin/openzeppelin-contracts@4.5.0/contracts/access/Ownable.sol";
import "../interfaces/ICrossDomainMessenger.sol";
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
        bytes32 fillHash,
        address filler
    );

    mapping (uint256 => ResolutionInfos) public resolutionInfos;

    function resolve(bytes32 fillHash, uint256 fillChainId, uint256 sourceChainId, address filler)
        external restricted(fillChainId, msg.sender) {

        ResolutionInfos storage info = resolutionInfos[sourceChainId];
        require(info.resolutionRegistry != address(0), "No registry available for source chain");
        require(info.messenger != address(0), "No messenger available for source chain");

        ICrossDomainMessenger messenger = ICrossDomainMessenger(info.messenger);
        messenger.sendMessage(
            info.resolutionRegistry,
            abi.encodeCall(
                ResolutionRegistry.resolveRequest,
                (
                    fillHash,
                    block.chainid,
                    filler
                )
            ),
            1_000_000
        );

        emit Resolution(sourceChainId, fillChainId, fillHash, filler);
    }

    function addRegistry(uint256 chainId, address resolutionRegistry, address messenger) external onlyOwner {
        resolutionInfos[chainId] = ResolutionInfos(resolutionRegistry, messenger);
    }
}
