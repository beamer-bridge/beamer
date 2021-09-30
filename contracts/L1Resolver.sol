// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "./lib/arbitrum/Inbox.sol";
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

    function resolve(uint256 requestId, address eligibleClaimer, uint256 maxSubmissionCost, uint256 maxGas, uint256 gasPriceBid) external {

        bytes memory resolveData = abi.encodeWithSelector(ResolveRegistry.resolveRequest.selector, requestId, eligibleClaimer);

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





}