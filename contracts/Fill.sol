// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "OpenZeppelin/openzeppelin-contracts@4.3.2/contracts/token/ERC20/IERC20.sol";

import "./lib/arbitrum/ArbSys.sol";

interface IProofWriter {
    function writeProof() public returns (bool);
}

contract ArbProofWriter {
    function writeProof(address l1Resolver, uint256 requestId) public returns (bool)
    {
        bytes memory proofData = abi.encodeWithSelector(
            l1Resolver.resolve.selector,
            requestId,  // requestId
            msg.sender, // eligibleClaimer
            1, // maxSubmissionCost
            1, // maxGas
            1 // gasPriceBid
        );

        // Send message to L1, this can be used to proof the fill tx on L1
        ArbSys.sendTxToL1(
            l1Resolver, // destination
            proofData // callDataForL1
        );
        return true;
    }
}

contract FillManager {
    address l1Resolver;
    IProofWriter proofWriter;

    mapping(bytes32 => bool) fills;

    constructor(address _l1Resolver, address _proofWriter) public
    {
        l1Resolver = _l1Resolver;
        proofWriter = IProofWriter(_proofWriter);
    }

    function fillRequest(
        uint256 sourceChainId,
        uint256 requestId,
        address targetTokenAddress,
        uint256 amount
    )
    external returns (bool)
    {
        bytes32 requestHash = keccak256(requestId, amount, targetTokenAddress, sourceChainId);
        require(!fills[requestHash], "Already filled");

        IERC20 token = IERC20(targetTokenAddress);
        require(token.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        require(proofWriter.writeProof(l1Resolver, requestId), "Writing proof data failed");

        fills[requestHash] = true;
        return true;
    }
}
