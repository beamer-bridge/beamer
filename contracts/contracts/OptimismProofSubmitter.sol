// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "../interfaces/IProofSubmitter.sol";
import "../interfaces/ICrossDomainMessenger.sol";

import "./BeamerUtils.sol";
import "./Resolver.sol";
import "./RestrictedCalls.sol";

contract OptimismProofSubmitter is IProofSubmitter, RestrictedCalls {

    uint32 private constant MESSAGE_GAS_LIMIT = 1_000_000;

    ICrossDomainMessenger public messenger;

    constructor(address _messenger)
    {
        messenger = ICrossDomainMessenger(_messenger);
    }

    function submitProof(address l1Resolver, bytes32 requestHash, uint256 sourceChainId, address filler)
        external restricted(block.chainid, msg.sender) returns (ProofReceipt memory)
    {
        bytes32 fillId = keccak256(abi.encode(block.number));
        bytes32 fillHash = BeamerUtils.createFillHash(requestHash, fillId);

        messenger.sendMessage(
            l1Resolver,
            abi.encodeCall(
                Resolver.resolve,
                (
                    fillHash,
                    block.chainid,
                    sourceChainId,
                    filler
                )
            ),
            MESSAGE_GAS_LIMIT
        );

        return ProofReceipt(fillId, fillHash);
    }

    function submitNonFillProof(address l1Resolver, uint256 sourceChainId, bytes32 fillHash) external {
        messenger.sendMessage(
            l1Resolver,
            abi.encodeCall(
                Resolver.resolveNonFill,
                    (
                        fillHash,
                        block.chainid,
                        sourceChainId
                    )
                ),
            MESSAGE_GAS_LIMIT
        );
    }
}
