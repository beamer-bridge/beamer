// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "OpenZeppelin/openzeppelin-contracts@4.8.0/contracts/access/Ownable.sol";

/// Liquidity Provider Whitelist.
///
/// This contract describes the concept of a whitelist for allowed Lps. RequestManager and FillManager
/// inherit from this contract.
contract LpWhitelist is Ownable {
    /// Emitted when a liquidity provider has been added to the set of allowed
    /// liquidity providers.
    ///
    /// .. seealso:: :sol:func:`addAllowedLp`
    event LpAdded(address lp);

    /// Emitted when a liquidity provider has been removed from the set of allowed
    /// liquidity providers.
    ///
    /// .. seealso:: :sol:func:`removeAllowedLp`
    event LpRemoved(address lp);

    /// The set of liquidity providers that are added to the whitelist.
    mapping(address => bool) public allowedLps;

    /// Modifier to check whether the sender is whitelisted
    modifier onlyWhitelist() {
        require(allowedLps[msg.sender], "Sender not whitelisted");
        _;
    }

    /// Add a liquidity provider to the set of allowed liquidity providers.
    ///
    /// .. note:: This function can only be called by the contract owner.
    ///
    /// @param newLp The liquidity provider.
    function addAllowedLp(address newLp) public onlyOwner {
        allowedLps[newLp] = true;

        emit LpAdded(newLp);
    }

    /// Remove a liquidity provider from the set of allowed liquidity providers.
    ///
    /// .. note:: This function can only be called by the contract owner.
    ///
    /// @param oldLp The liquidity provider.
    function removeAllowedLp(address oldLp) public onlyOwner {
        delete allowedLps[oldLp];

        emit LpRemoved(oldLp);
    }
}
