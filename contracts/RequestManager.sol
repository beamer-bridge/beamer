// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "OpenZeppelin/openzeppelin-contracts@4.3.2/contracts/token/ERC20/IERC20.sol";

contract RequestManager {

    struct Request {
        uint256 targetChainId;
        address targetTokenAddress;
        address targetAddress;
        uint256 amount;
    }

    event RequestCreated(
        uint256 indexed requestId,
        uint256 indexed targetChainId,
        address indexed targetTokenAddress,
        uint256 amount
    );

    uint256 public requestCounter;
    mapping (uint256 => Request) public requests;

    function request(
        uint256 targetChainId,
        address sourceTokenAddress,
        address targetTokenAddress,
        address targetAddress,
        uint256 amount
    )
    external returns (uint256)
    {
        requestCounter += 1;
        uint256 requestId = requestCounter;

        Request storage newRequest = requests[requestId];
        newRequest.targetChainId = targetChainId;
        newRequest.targetTokenAddress = targetTokenAddress;
        newRequest.targetAddress = targetAddress;
        newRequest.amount = amount;

        emit RequestCreated(
            requestId,
            targetChainId,
            targetTokenAddress,
            amount
        );

        IERC20 token = IERC20(sourceTokenAddress);
        require(token.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        return requestId;
    }
}
