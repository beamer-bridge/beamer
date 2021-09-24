// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "OpenZeppelin/openzeppelin-contracts@4.3.2/contracts/token/ERC20/IERC20.sol";

contract RaiSync {

    struct Request {
        uint256 chain_id;
        address token_address_source;
        address token_address_target;
        uint256 amount;
        address target_address;
    }

    event RequestCreated(
        uint256 request_id,
        uint256 indexed chain_id,
        address indexed token_address_target,
        uint256 amount
    );

    uint256 public request_counter;
    mapping (uint256 => Request) public requests;


    function request(
        uint256 chain_id,
        address token_address_source,
        address token_address_target,
        uint256 amount,
        address target_address
    )
    external returns (uint256)
    {
        request_counter += 1;
        uint256 request_id = request_counter;

        Request storage new_request = requests[request_id];
        new_request.chain_id = chain_id;
        new_request.token_address_source = token_address_source;
        new_request.token_address_target = token_address_target;
        new_request.amount = amount;
        new_request.target_address = target_address;

        emit RequestCreated(
            request_id,
            chain_id,
            token_address_target,
            amount
        );

        IERC20 token = IERC20(token_address_source);
        require(token.transferFrom(msg.sender, address(this), amount), "transfer failed");

        return request_id;
    }

    function withdraw(
        address target_address
    )
    external
    {}
}
