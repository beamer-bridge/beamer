// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "OpenZeppelin/openzeppelin-contracts@4.5.0/contracts/access/Ownable.sol";

/// A helper contract that provides a way to restrict callers of restricted functions
/// to a single address. This allows for a trusted call chain,
/// as described in :ref:`contracts' architecture <contracts-architecture>`.
///
/// .. seealso:: :sol:contract:`CrossDomainRestrictedCalls`
contract RestrictedCalls is Ownable {
    /// The set of callers, in the form of hashed pairs ``(chainId, address)``.
    mapping(bytes32 => bool) public callers;

    /// Add a caller for the given chain ID.
    ///
    /// @param chainId The chain ID.
    /// @param caller The caller.
    function addCaller(uint256 chainId, address caller) external onlyOwner {
        bytes32 key = keccak256(abi.encodePacked(chainId, caller));

        require(!callers[key], "RestrictedCalls: caller already exists");
        callers[key] = true;
    }

    /// Mark the function as restricted.
    ///
    /// Calls to the restricted function can only come from an address that
    /// was previously added by a call to :sol:func:`addCaller`.
    ///
    /// Example usage::
    ///
    ///     restricted(block.chainid, msg.sender)
    ///
    modifier restricted(uint256 chainId, address caller) {
        bytes32 key = keccak256(abi.encodePacked(chainId, caller));

        require(callers[key], "RestrictedCalls: unknown caller");
        _;
    }
}
