// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;
import "OpenZeppelin/openzeppelin-contracts@4.8.0/contracts/token/ERC20/IERC20.sol";
import "OpenZeppelin/openzeppelin-contracts@4.8.0/contracts/token/ERC20/utils/SafeERC20.sol";
import "OpenZeppelin/openzeppelin-contracts@4.8.0/contracts/access/Ownable.sol";

import "./RequestManager.sol";

contract FeeSub is Ownable {
    using SafeERC20 for IERC20;

    RequestManager public requestManager;
    mapping(address token => uint256) public minimumAmounts;
    mapping(bytes32 requestId => address sender) public senders;

    constructor(address _requestManager) {
        requestManager = RequestManager(_requestManager);
    }

    function createRequest(
        uint256 targetChainId,
        address sourceTokenAddress,
        address targetTokenAddress,
        address targetAddress,
        uint256 amount,
        uint256 validityPeriod
    ) external returns (bytes32) {
        require(
            minimumAmounts[sourceTokenAddress] > 0,
            "Token not to be subsidized"
        );
        require(
            amount >= minimumAmounts[sourceTokenAddress],
            "Transfer amount too small to be subsidized"
        );

        require(
            IERC20(sourceTokenAddress).allowance(msg.sender, address(this)) >=
                amount,
            "Insufficient allowance"
        );

        IERC20(sourceTokenAddress).safeTransferFrom(
            msg.sender,
            address(this),
            amount
        );

        bytes32 requestId = requestManager.createRequest(
            targetChainId,
            sourceTokenAddress,
            targetTokenAddress,
            targetAddress,
            amount,
            validityPeriod
        );
        senders[requestId] = msg.sender;

        return requestId;
    }

    function withdrawExpiredRequest(bytes32 requestId) external {
        (
            address sender,
            address sourceTokenAddress,
            ,
            uint256 amount,
            ,
            ,
            ,
            ,
            uint96 withdrawClaimId,
            ,

        ) = requestManager.requests(requestId);
        require(
            sender == address(this),
            "Request was not created by this contract"
        );
        require(
            senders[requestId] != address(0),
            "Already refunded to the sender"
        );

        if (withdrawClaimId == 0) {
            // This will fail if the funds do not belong to the original sender (yet)
            requestManager.withdrawExpiredRequest(requestId);
        } else {
            // Make sure that funds were withdrawn by calling withdrawExpiredRequest()
            require(
                withdrawClaimId == type(uint96).max,
                "Request was withdrawn by another address"
            );
        }

        address recipient = senders[requestId];
        senders[requestId] = address(0);

        IERC20 token = IERC20(sourceTokenAddress);
        token.safeTransfer(recipient, amount);
    }

    function tokenAmountCanBeSubsidized(
        uint256 targetChainId,
        address tokenAddress,
        uint256 amount
    ) public view returns(bool) {
        uint256 minimumAmount = minimumAmounts[tokenAddress];

        if(minimumAmount == 0 || minimumAmount > amount){
            return false;
        }

        uint256 tokenBalance = IERC20(tokenAddress).balanceOf(address(this));
        uint256 totalFee = requestManager.totalFee(targetChainId, tokenAddress, amount);

        if(
            tokenBalance < totalFee
        ){
            return false;
        }

        return true;
    }

    function setMinimumAmount(
        address tokenAddress,
        uint256 amount
    ) external onlyOwner {
        if (amount > 0 && minimumAmounts[tokenAddress] == 0) {
            IERC20(tokenAddress).approve(
                address(requestManager),
                type(uint256).max
            );
        } else if (amount == 0 && minimumAmounts[tokenAddress] != 0) {
            IERC20(tokenAddress).approve(address(requestManager), 0);
        }
        minimumAmounts[tokenAddress] = amount;
    }
}
