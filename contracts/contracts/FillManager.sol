// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "OpenZeppelin/openzeppelin-contracts@4.5.0/contracts/token/ERC20/IERC20.sol";
import "OpenZeppelin/openzeppelin-contracts@4.5.0/contracts/token/ERC20/utils/SafeERC20.sol";
import "OpenZeppelin/openzeppelin-contracts@4.5.0/contracts/access/Ownable.sol";
import "../interfaces/IProofSubmitter.sol";
import "./BeamerUtils.sol";


contract FillManager is Ownable {
    using SafeERC20 for IERC20;

    event RequestFilled(
        uint256 indexed requestId,
        bytes32 fillId,
        uint256 indexed sourceChainId,
        address indexed targetTokenAddress,
        address filler,
        uint256 amount
    );

    event HashInvalidated(
        bytes32 indexed requestHash,
        bytes32 indexed fillId,
        bytes32 indexed fillHash
    );

    event LPAdded(
        address lp
    );

    event LPRemoved(
        address lp
    );

    address public l1Resolver;
    IProofSubmitter public proofSubmitter;

    // mapping from request hash to fill hash of filled requests
    mapping(bytes32 => bytes32) public fills;
    mapping(address => bool) public allowedLPs;

    constructor(address _l1Resolver, address _proofSubmitter)
    {
        l1Resolver = _l1Resolver;
        proofSubmitter = IProofSubmitter(_proofSubmitter);
    }

    function fillRequest(
        uint256 requestId,
        uint256 sourceChainId,
        address targetTokenAddress,
        address targetReceiverAddress,
        uint256 amount
    )
    external
    returns (bytes32)
    {
        require(allowedLPs[msg.sender], "Sender not whitelisted");
        bytes32 requestHash = BeamerUtils.createRequestHash(
                requestId, sourceChainId, block.chainid, targetTokenAddress, targetReceiverAddress, amount
            );

        require(fills[requestHash] == bytes32(0), "Already filled");

        IERC20 token = IERC20(targetTokenAddress);
        token.safeTransferFrom(msg.sender, targetReceiverAddress, amount);

        IProofSubmitter.ProofReceipt memory proofReceipt = proofSubmitter.submitProof(
            l1Resolver,
            sourceChainId,
            requestId,
            requestHash,
            msg.sender
            );
        require(
            proofReceipt.fillId != 0,
            "Submitting proof data failed"
        );

        fills[requestHash] = proofReceipt.fillHash;

        emit RequestFilled(requestId, proofReceipt.fillId, sourceChainId, targetTokenAddress, msg.sender, amount);

        return proofReceipt.fillId;
    }

    function invalidateFillHash(
        uint256 requestId,
        bytes32 requestHash,
        bytes32 fillId,
        uint256 sourceChainId
    ) external {
        bytes32 fillHash = BeamerUtils.createFillHash(requestHash, fillId);
        require(fills[requestHash] != fillHash, "Fill hash valid");
        proofSubmitter.submitNonFillProof(l1Resolver, sourceChainId, requestId, fillHash);
        emit HashInvalidated(requestHash, fillId, fillHash);
    }

    function addAllowedLP(address newLP) public onlyOwner {
        allowedLPs[newLP] = true;

        emit LPAdded(newLP);
    }

    function removeAllowedLP(address oldLP) public onlyOwner {
        delete allowedLPs[oldLP];

        emit LPRemoved(oldLP);
    }
}
