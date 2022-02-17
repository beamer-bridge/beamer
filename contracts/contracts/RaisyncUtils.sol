// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;


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

    function createFillHash(bytes32 requestHash, bytes32 fillId) internal pure returns (bytes32){
        return keccak256(abi.encodePacked(requestHash, fillId));
    }

    function createFillHash(
        uint256 requestId,
        uint256 sourceChainId,
        address targetTokenAddress,
        address targetReceiverAddress,
        uint256 amount,
        bytes32 fillId
    ) internal pure returns (bytes32){
        return createFillHash(
            createRequestHash(
                requestId, sourceChainId, targetTokenAddress, targetReceiverAddress, amount
            ),
                fillId
        );
    }

}
