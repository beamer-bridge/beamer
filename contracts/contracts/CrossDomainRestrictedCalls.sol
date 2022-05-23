// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "OpenZeppelin/openzeppelin-contracts@4.5.0/contracts/access/Ownable.sol";
import "../interfaces/IMessenger.sol";

contract CrossDomainRestrictedCalls is Ownable {
    struct MessengerSource {
        IMessenger messenger;
        address sender;
    }

    mapping(uint256 => MessengerSource) public messengers;

    function addCaller(
        uint256 chainId,
        address messenger,
        address caller
    ) external onlyOwner {
        require(messenger != address(0), "XRestrictedCalls: invalid messenger");
        messengers[chainId] = MessengerSource(IMessenger(messenger), caller);
    }

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
