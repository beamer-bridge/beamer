// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;


library BeamerUtils {

    function createRequestHash(
        uint256 requestId,
        uint256 sourceChainId,
        uint256 targetChainId,
        address targetTokenAddress,
        address targetReceiverAddress,
        uint256 amount
    ) internal pure returns (bytes32){
        return keccak256(
            abi.encodePacked(
                requestId, sourceChainId, targetChainId, targetTokenAddress, targetReceiverAddress, amount
            )
        );
    }

    function createFillHash(bytes32 requestHash, bytes32 fillId) internal pure returns (bytes32){
        return keccak256(abi.encodePacked(requestHash, fillId));
    }

    function createFillHash(
        uint256 requestId,
        uint256 sourceChainId,
        uint256 targetChainId,
        address targetTokenAddress,
        address targetReceiverAddress,
        uint256 amount,
        bytes32 fillId
    ) internal pure returns (bytes32){
        return createFillHash(
            createRequestHash(
                requestId, sourceChainId, targetChainId, targetTokenAddress, targetReceiverAddress, amount
            ),
                fillId
        );
    }

}
