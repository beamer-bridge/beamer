// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "../../../interfaces/IMessenger.sol";
import "../../../interfaces/IProofSubmitter.sol";

import "../../BeamerUtils.sol";
import "../../Resolver.sol";
import "../../RestrictedCalls.sol";

contract TestProofSubmitter is IProofSubmitter, RestrictedCalls {
    IMessenger private messenger;
    uint32 private constant MESSAGE_GAS_LIMIT = 1_000_000;

    constructor(address messenger_) {
        messenger = IMessenger(messenger_);
    }

    function submitProof(
        address l1Resolver,
        uint256 sourceChainId,
        bytes32 requestHash,
        address filler
    )
        external
        restricted(block.chainid, msg.sender)
        returns (ProofReceipt memory)
    {
        bytes32 fillId = blockhash(block.number - 1);
        bytes32 fillHash = BeamerUtils.createFillHash(requestHash, fillId);

        messenger.sendMessage(
            l1Resolver,
            abi.encodeCall(
                Resolver.resolve,
                (requestHash, fillId, block.chainid, sourceChainId, filler)
            ),
            MESSAGE_GAS_LIMIT
        );

        return ProofReceipt(fillId, fillHash);
    }

    function submitNonFillProof(
        address l1Resolver,
        uint256 sourceChainId,
        bytes32 requestHash,
        bytes32 fillId
    ) external {
        messenger.sendMessage(
            l1Resolver,
            abi.encodeCall(
                Resolver.resolveNonFill,
                (requestHash, fillId, block.chainid, sourceChainId)
            ),
            MESSAGE_GAS_LIMIT
        );
    }
}
