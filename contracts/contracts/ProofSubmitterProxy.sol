// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "OpenZeppelin/openzeppelin-contracts@4.5.0/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract ProofSubmitterProxy is ERC1967Proxy {

    constructor(address _logic, bytes memory _data) ERC1967Proxy(_logic, _data) {
        _changeAdmin(msg.sender);
    }

    function changeAdmin(address newAdmin) public {
        require(msg.sender == _getAdmin(), "ProofSubmitterProxy: only admin can change admin");
        _changeAdmin(newAdmin);
    }

    function getAdmin() public view returns (address){
        return _getAdmin();
    }

    function upgradeTo(address newImplementation) public {
        require(msg.sender == _getAdmin(), "ProofSubmitterProxy: only admin can upgrade implementation");
        _upgradeTo(newImplementation);
    }

    function getImplementation() public view returns (address) {
        return _getImplementation();
    }
}
