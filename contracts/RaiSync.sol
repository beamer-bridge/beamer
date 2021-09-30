// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "OpenZeppelin/openzeppelin-contracts@4.3.2/contracts/token/ERC20/IERC20.sol";

contract RaiSync {

    struct Request {
        uint256 targetChainId;
        address targetTokenAddress;
        address targetAddress;
        uint256 amount;
    }

    event RequestCreated(
        uint256 requestId,
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

        Request storage new_request = requests[requestId];
        new_request.targetChainId = targetChainId;
        new_request.targetTokenAddress = targetTokenAddress;
        new_request.targetAddress = targetAddress;
        new_request.amount = amount;

        emit RequestCreated(
            requestId,
            targetChainId,
            targetTokenAddress,
            amount
        );

        IERC20 token = IERC20(sourceTokenAddress);
        require(token.transferFrom(msg.sender, address(this), amount), "transfer failed");

        return requestId;
    }

    function withdraw(
        address targetAddress
    )
    external
    {}
}
