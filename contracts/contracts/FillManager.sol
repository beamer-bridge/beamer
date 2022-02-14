// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "OpenZeppelin/openzeppelin-contracts@4.4.2/contracts/token/ERC20/IERC20.sol";
import "OpenZeppelin/openzeppelin-contracts@4.4.2/contracts/access/Ownable.sol";
import "../interfaces/IProofSubmitter.sol";


contract FillManager is Ownable {

    event RequestFilled(
        uint256 indexed requestId,
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
    {
        require(allowedLPs[msg.sender], "Sender not whitelisted");
        bytes32 requestHash = keccak256(
            abi.encodePacked(
                requestId, sourceChainId, targetTokenAddress, targetReceiverAddress, amount
            )
        );
        require(!fills[requestHash], "Already filled");
        fills[requestHash] = true;

        emit RequestFilled(requestId, sourceChainId, targetTokenAddress, msg.sender, amount);

        IERC20 token = IERC20(targetTokenAddress);
        require(token.transferFrom(msg.sender, targetReceiverAddress, amount), "Transfer failed");

        require(
            proofSubmitter.submitProof(l1Resolver, requestHash, sourceChainId, msg.sender),
            "Submitting proof data failed"
        );
    }

    function addAllowedLP(address newLP) public onlyOwner {
        allowedLPs[newLP] = true;
    }

    function removeAllowedLP(address oldLP) public onlyOwner {
        delete allowedLPs[oldLP];
    }
}
