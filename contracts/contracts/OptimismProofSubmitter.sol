// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "../interfaces/IProofSubmitter.sol";
import "../interfaces/ICrossDomainMessenger.sol";

import "./Resolver.sol";

contract OptimismProofSubmitter is IProofSubmitter {
    ICrossDomainMessenger messenger;

    constructor(address _messenger)
    {
        messenger = ICrossDomainMessenger(_messenger);
    }

    function submitProof(address l1Resolver, uint256 requestId, uint256 sourceChainId, address eligibleClaimer) external returns (bool)
    {
        // Questions
        // - what gas limit
        // TODO: use abi.encodeCall once
        // https://github.com/ethereum/solidity/pull/12437 is released
        messenger.sendMessage(
            l1Resolver,
            abi.encodeWithSelector(
                Resolver.resolve.selector,
                requestId,
                block.chainid,
                sourceChainId,
                eligibleClaimer
            ),
            1_000_000
        );

        return true;
    }
}
