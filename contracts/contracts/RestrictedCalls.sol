// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "OpenZeppelin/openzeppelin-contracts@4.4.2/contracts/access/Ownable.sol";

contract RestrictedCalls is Ownable {
    mapping (bytes32 => bool) public callers;

    function addCaller(uint256 chainId, address caller) external onlyOwner {
        bytes32 key = keccak256(abi.encodePacked(chainId, caller));

        require(!callers[key], "RestrictedCalls: caller already exists");
        callers[key] = true;
    }

    modifier restricted(uint256 chainId, address caller) {
        bytes32 key = keccak256(abi.encodePacked(chainId, caller));

        require(callers[key], "RestrictedCalls: unknown caller");
        _;
    }
}
