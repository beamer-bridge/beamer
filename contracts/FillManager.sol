// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "OpenZeppelin/openzeppelin-contracts@4.3.2/contracts/token/ERC20/IERC20.sol";

interface IProofWriter {
    function writeProof(address l1Resolver, uint256 requestId) external returns (bool);
}

contract DummyProofWriter {
    function writeProof(address l1Resolver, uint256 requestId) external returns (bool)
    {
        return true;
    }
}

contract FillManager {
    address l1Resolver;
    IProofWriter proofWriter;

    mapping(bytes32 => bool) fills;

    constructor(address _l1Resolver, address _proofWriter)
    {
        l1Resolver = _l1Resolver;
        proofWriter = IProofWriter(_proofWriter);
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
        bytes32 requestHash = keccak256(
            abi.encodePacked(
                requestId, sourceChainId, targetTokenAddress, targetReceiverAddress, amount
            )
        );
        require(!fills[requestHash], "Already filled");
        fills[requestHash] = true;

        IERC20 token = IERC20(targetTokenAddress);
        require(token.transferFrom(msg.sender, targetReceiverAddress, amount), "Transfer failed");

        require(proofWriter.writeProof(l1Resolver, requestId), "Writing proof data failed");
    }
}
