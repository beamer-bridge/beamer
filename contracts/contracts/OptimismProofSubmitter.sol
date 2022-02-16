// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "../interfaces/IProofSubmitter.sol";
import "../interfaces/ICrossDomainMessenger.sol";

import "./RaisyncUtils.sol";
import "./Resolver.sol";
import "./RestrictedCalls.sol";

contract OptimismProofSubmitter is IProofSubmitter, RestrictedCalls {
    ICrossDomainMessenger messenger;

    constructor(address _messenger)
    {
        messenger = ICrossDomainMessenger(_messenger);
    }

    function submitProof(address l1Resolver, bytes32 requestHash, uint256 sourceChainId, address eligibleClaimer)
        external restricted(block.chainid, msg.sender) returns (uint256)
    {
        // Questions
        // - what gas limit
        // TODO: use abi.encodeCall once
        // https://github.com/ethereum/solidity/pull/12437 is released
        messenger.sendMessage(
            l1Resolver,
            abi.encodeWithSelector(
                Resolver.resolve.selector,
                RaisyncUtils.createFillHash(requestHash, block.number),
                block.chainid,
                sourceChainId,
                eligibleClaimer
            ),
            1_000_000
        );

        return block.number;
    }
}
