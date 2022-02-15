// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "OpenZeppelin/openzeppelin-contracts@4.4.2/contracts/access/Ownable.sol";
import "../interfaces/ICrossDomainMessenger.sol";


contract CrossDomainRestrictedCalls is Ownable {
    struct MessengerSource {
        ICrossDomainMessenger crossDomainMessenger;
        address sender;
    }

    mapping (uint256 => MessengerSource) public messengers;

    function addCaller(uint256 chainId, address messenger, address caller) external onlyOwner {
        messengers[chainId] = MessengerSource(ICrossDomainMessenger(messenger), caller);
    }

    modifier restricted(uint256 chainId, address caller) {
        MessengerSource storage s = messengers[chainId];
        require(
            caller == address(s.crossDomainMessenger), "XRestrictedCalls: unknown caller"
        );
        require(
            s.crossDomainMessenger.xDomainMessageSender() == s.sender,
            "XRestrictedCalls: unknown caller"
        );
        _;
    }
}
