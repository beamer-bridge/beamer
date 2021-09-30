// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "./lib/arbitrum/Inbox.sol";
import "./lib/arbitrum/Outbox.sol";
import "./ResolveRegistry.sol";

contract L1Resolver{

    event RequestResolutionSentToArbitrum(
        uint256 requestId,
        address eligibleClaimer,
        uint256 ticketID
    );

    IInbox arbitrumInbox;
    address optimismMailbox;

    address arbitrumResolveRegistry;

    constructor(address arbitrumInboxAddress){
        arbitrumInbox = IInbox(arbitrumInboxAddress);
    }

    function resolve(uint256 fillChainId, uint256 requestId, address eligibleClaimer, uint256 maxSubmissionCost, uint256 maxGas, uint256 gasPriceBid) external {
        // TODO: use `fillChainId` here to select correct `ResolveRegistry`
        bytes memory resolveData = abi.encodeWithSelector(
            ResolveRegistry.resolveRequest.selector,
            requestId,
            eligibleClaimer
        );

        uint256 ticketID = arbitrumInbox.createRetryableTicket(
            arbitrumResolveRegistry,
            0,
            maxSubmissionCost,
            msg.sender,
            msg.sender,
            maxGas,
            gasPriceBid,
            resolveData
        );

        emit RequestResolutionSentToArbitrum(
            requestId,
            eligibleClaimer,
            ticketID
        );
    }

    function getOutboxData() public
    {
        // this data comes from `NodeInterface.lookupMessageBatchProof`
        // see also https://github.com/OffchainLabs/arbitrum-tutorials/blob/master/packages/outbox-execute/scripts/exec.js
        Outbox.executeTransaction(
            //uint256 outboxIndex,
            //bytes32[] calldata proof,
            //uint256 index,
            //address l2Sender,
            //address destAddr,
            //uint256 l2Block,
            //uint256 l1Block,
            //uint256 l2Timestamp,
            //uint256 amount,
            //bytes calldata calldataForL1
        );
    }
}
