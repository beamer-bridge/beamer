// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;


library RaisyncUtils {

    function createRequestHash(
        uint256 requestId,
        uint256 sourceChainId,
        address targetTokenAddress,
        address targetReceiverAddress,
        uint256 amount
    ) internal pure returns (bytes32){
        return keccak256(
            abi.encodePacked(
                requestId, sourceChainId, targetTokenAddress, targetReceiverAddress, amount
            )
        );
    }

    function createFillHash(bytes32 requestHash, uint256 fillId) internal pure returns (bytes32){
        return keccak256(abi.encodePacked(requestHash, fillId));
    }

    function createFillHash(
        uint256 requestId,
        uint256 sourceChainId,
        address targetTokenAddress,
        address targetReceiverAddress,
        uint256 amount,
        uint256 fillId
    ) internal pure returns (bytes32){
        return createFillHash(
            createRequestHash(
                requestId, sourceChainId, targetTokenAddress, targetReceiverAddress, amount
            ),
                fillId
        );
    }

}