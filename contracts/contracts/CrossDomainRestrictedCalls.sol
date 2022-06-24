// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "OpenZeppelin/openzeppelin-contracts@4.5.0/contracts/access/Ownable.sol";
import "../interfaces/IMessenger.sol";

/// A helper contract that provides a way to restrict cross-domain callers of
/// restricted functions to a single address. This allows for a trusted call chain,
/// as described in :ref:`contracts' architecture <contracts-architecture>`.
///
/// Unlike :sol:contract:`RestrictedCalls`, which is used for calls on the same chain,
/// this contract is used to restrict calls that come from a chain different from the
/// one this contract is deployed on.
///
/// .. seealso:: :sol:contract:`RestrictedCalls` :sol:interface:`IMessenger`
contract CrossDomainRestrictedCalls is Ownable {
    struct MessengerSource {
        IMessenger messenger;
        address sender;
    }

    /// Maps chain IDs to messenger and callers.
    mapping(uint256 => MessengerSource) public messengers;

    /// Add a caller for the given chain ID.
    ///
    /// .. note:: There can only be one caller per chain.
    ///
    /// @param chainId The chain ID.
    /// @param messenger The messenger, an instance of :sol:interface:`IMessenger`.
    /// @param caller The caller.
    function addCaller(
        uint256 chainId,
        address messenger,
        address caller
    ) external onlyOwner {
        require(messenger != address(0), "XRestrictedCalls: invalid messenger");
        messengers[chainId] = MessengerSource(IMessenger(messenger), caller);
    }

    /// Mark the function as restricted.
    ///
    /// Calls to the restricted function can only come from one address, that
    /// was previously added by a call to :sol:func:`addCaller`.
    ///
    /// Example usage::
    ///
    ///     restricted(foreignChainId, msg.sender)
    ///
    modifier restricted(uint256 chainId, address caller) {
        MessengerSource storage s = messengers[chainId];
        require(
            address(s.messenger) != address(0),
            "XRestrictedCalls: unknown caller"
        );
        require(
            caller == s.messenger.nativeMessenger(),
            "XRestrictedCalls: unknown caller"
        );
        require(
            s.messenger.originalSender() == s.sender,
            "XRestrictedCalls: unknown caller"
        );
        _;
    }
}
