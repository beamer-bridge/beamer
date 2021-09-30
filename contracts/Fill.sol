// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "OpenZeppelin/openzeppelin-contracts@4.3.2/contracts/token/ERC20/IERC20.sol";

import "./lib/arbitrum/ArbSys.sol";

contract Fill {

    address l1Resolver;

    function fillRequest(uint256 sourceChainId, uint256 requestId, address targetTokenAddress, uint256 amount)
    external returns (bool)
    {
        IERC20 token = IERC20(targetTokenAddress);
        require(token.transferFrom(msg.sender, address(this), amount), "transfer failed");

        bytes memory proofData = abi.encodeWithSelector(
            L1Resolver.resolve.selector,
            requestId,  // requestId
            msg.sender, // eligibleClaimer
            1, // maxSubmissionCost
            1, // maxGas
            1 // gasPriceBid
        );

        // Send message to L1, this can be used to proof the fill tx on L1
        messageId = ArbSys.sendTxToL1(
            l1Resolver, // destination
            proofData // callDataForL1
        );

        return true;
    }
}
