// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "OpenZeppelin/openzeppelin-contracts@4.4.2/contracts/token/ERC20/IERC20.sol";
import "OpenZeppelin/openzeppelin-contracts@4.4.2/contracts/token/ERC20/utils/SafeERC20.sol";
import "OpenZeppelin/openzeppelin-contracts@4.4.2/contracts/access/Ownable.sol";
import "../interfaces/IProofSubmitter.sol";


contract FillManager is Ownable {
    using SafeERC20 for IERC20;

    event RequestFilled(
        uint256 indexed requestId,
        uint256 fillId,
        uint256 indexed sourceChainId,
        address indexed targetTokenAddress,
        address filler,
        uint256 amount
    );

    address l1Resolver;
    IProofSubmitter proofSubmitter;

    mapping(bytes32 => bool) fills;
    mapping(address => bool) allowedLPs;

    constructor(address _l1Resolver, address _proofSubmitter)
    {
        l1Resolver = _l1Resolver;
        proofSubmitter = IProofSubmitter(_proofSubmitter);
    }

    function fillRequest(
        uint256 sourceChainId,
        uint256 requestId,
        address targetTokenAddress,
        address targetReceiverAddress,
        uint256 amount
    )
    external
    returns (uint256)
    {
        require(allowedLPs[msg.sender], "Sender not whitelisted");
        bytes32 requestHash = keccak256(
            abi.encodePacked(
                requestId, sourceChainId, targetTokenAddress, targetReceiverAddress, amount
            )
        );
        require(!fills[requestHash], "Already filled");
        fills[requestHash] = true;

        IERC20 token = IERC20(targetTokenAddress);
        token.safeTransferFrom(msg.sender, targetReceiverAddress, amount);

        uint256 fillId = proofSubmitter.submitProof(l1Resolver, requestHash, sourceChainId, msg.sender);
        require(
            fillId != 0,
            "Submitting proof data failed"
        );

        emit RequestFilled(requestId, fillId, sourceChainId, targetTokenAddress, msg.sender, amount);

        return fillId;
    }

    function addAllowedLP(address newLP) public onlyOwner {
        allowedLPs[newLP] = true;
    }

    function removeAllowedLP(address oldLP) public onlyOwner {
        delete allowedLPs[oldLP];
    }
}
