// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "../interfaces/IProofSubmitter.sol";
import "../interfaces/ICrossDomainMessenger.sol";

import "./RaisyncUtils.sol";
import "./Resolver.sol";
import "./RestrictedCalls.sol";

contract OptimismProofSubmitter is IProofSubmitter, RestrictedCalls {
    ICrossDomainMessenger public messenger;

    constructor(address _messenger)
    {
        messenger = ICrossDomainMessenger(_messenger);
    }

    function submitProof(address l1Resolver, bytes32 requestHash, uint256 sourceChainId, address filler)
        external restricted(block.chainid, msg.sender) returns (bytes32)
    {
        bytes32 fillId = keccak256(abi.encode(block.number));

        messenger.sendMessage(
            l1Resolver,
            abi.encodeCall(
                Resolver.resolve,
                (
                    RaisyncUtils.createFillHash(requestHash, fillId),
                    block.chainid,
                    sourceChainId,
                    filler
                )
            ),
            1_000_000
        );

        return fillId;
    }
}
