// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "OpenZeppelin/openzeppelin-contracts@4.4.2/contracts/access/Ownable.sol";
import "../interfaces/ICrossDomainMessenger.sol";
import "./ResolutionRegistry.sol";
import "./CrossDomainRestrictedCalls.sol";


contract Resolver is Ownable, CrossDomainRestrictedCalls {
    event Resolution(
        uint256 sourceChainId,
        uint256 fillChainId,
        bytes32 requestHash,
        address eligibleClaimer
    );

    ICrossDomainMessenger l2Messenger;
    mapping (uint256 => address) public resolutionRegistries;

    constructor(address _l2Messenger)
    {
        l2Messenger = ICrossDomainMessenger(_l2Messenger);
    }

    function resolve(bytes32 requestHash, uint256 fillId, uint256 fillChainId, uint256 sourceChainId, address filler)
        external restricted(fillChainId, msg.sender) {

        address l2RegistryAddress = resolutionRegistries[sourceChainId];
        require(l2RegistryAddress != address(0), "No registry available for source chain");

        l2Messenger.sendMessage(
            l2RegistryAddress,
            abi.encodeWithSelector(
                ResolutionRegistry.resolveRequest.selector,
                requestHash,
                fillId,
                block.chainid,
                filler
            ),
            1_000_000
        );

        emit Resolution(sourceChainId, fillChainId, requestHash, filler);
    }

    function addRegistry(uint256 chainId, address resolutionRegistry) external onlyOwner {
        resolutionRegistries[chainId] = resolutionRegistry;
    }
}
