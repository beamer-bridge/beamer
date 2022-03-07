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

    event LPAdded(
        address lp
    );

    event LPRemoved(
        address lp
    );

    address public l1Resolver;
    IProofSubmitter public proofSubmitter;

    mapping(bytes32 => bool) public fills;
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

        require(!fills[requestHash], "Already filled");
        fills[requestHash] = true;

        IERC20 token = IERC20(targetTokenAddress);
        token.safeTransferFrom(msg.sender, targetReceiverAddress, amount);

        bytes32 fillId = proofSubmitter.submitProof(l1Resolver, requestHash, sourceChainId, msg.sender);
        require(
            fillId != 0,
            "Submitting proof data failed"
        );

        emit RequestFilled(requestId, fillId, sourceChainId, targetTokenAddress, msg.sender, amount);

        return fillId;
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
