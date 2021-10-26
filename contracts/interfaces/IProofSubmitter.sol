// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

interface IProofSubmitter {
    function submitProof(address l1Resolver, uint256 requestId) external returns (bool);
}
