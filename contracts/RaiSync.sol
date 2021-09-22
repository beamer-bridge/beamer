// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;
pragma abicoder v2;

contract RaiSync {

    struct Request {
        uint256 chain_id;
        address token_address;
        uint256 amount;
        address target_address;
    }

    event RequestCreated(
        uint256 request_id,
        uint256 indexed chain_id,
        address indexed token_address,
        uint256 amount
    );

    uint256 public request_counter;
    mapping (uint256 => Request) public requests;


    function request(
        uint256 chain_id,
        address token_address,
        uint256 amount,
        address target_address
    )
    external returns (uint256)
    {
        request_counter += 1;
        uint256 request_id = request_counter;

        Request storage new_request = requests[request_id];
        new_request.chain_id = chain_id;
        new_request.token_address = token_address;
        new_request.amount = amount;
        new_request.target_address = target_address;

        emit RequestCreated(
            request_id,
            chain_id,
            token_address,
            amount
        );

        return request_id;
    }

    function withdraw(
        address target_address
    )
    external
    {}
}