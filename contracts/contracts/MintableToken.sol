// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "OpenZeppelin/openzeppelin-contracts@4.8.0/contracts/token/ERC20/ERC20.sol";

contract MintableToken is ERC20 {
    constructor(uint256 initialSupply) ERC20("Test", "TST") {
        _mint(msg.sender, initialSupply);
    }

    function mint(address to, uint256 amount) public virtual {
        _mint(to, amount);
    }
}
