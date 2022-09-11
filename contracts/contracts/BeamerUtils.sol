// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

library BeamerUtils {
    struct FillInfo {
        address filler;
        bytes32 fillId;
    }

    function createRequestId(
        uint256 sourceChainId,
        uint256 targetChainId,
        address targetTokenAddress,
        address targetReceiverAddress,
        uint256 amount,
        uint256 nonce
    ) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    sourceChainId,
                    targetChainId,
                    targetTokenAddress,
                    targetReceiverAddress,
                    amount,
                    nonce
                )
            );
    }

    function createFillHash(bytes32 requestId, bytes32 fillId)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(requestId, fillId));
    }

    function createFillHash(
        uint256 sourceChainId,
        uint256 targetChainId,
        address targetTokenAddress,
        address targetReceiverAddress,
        uint256 amount,
        uint256 nonce,
        bytes32 fillId
    ) internal pure returns (bytes32) {
        return
            createFillHash(
                createRequestId(
                    sourceChainId,
                    targetChainId,
                    targetTokenAddress,
                    targetReceiverAddress,
                    amount,
                    nonce
                ),
                fillId
            );
    }
}
