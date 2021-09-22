// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "OpenZeppelin/openzeppelin-contracts@4.3.2/contracts/access/Ownable.sol";

contract ClaimManager is Ownable{

    struct Claim{
        uint256 requestId;
        address claimer;
        uint256 termination;
        bool challenged;
    }

    event ClaimCreated(
        uint256 claimId,
        uint256 requestId,
        address claimer,
        uint256 termination
    );

    uint256 claimStake;
    uint256 claimPeriod;
    mapping (uint256 => Claim) public claims;
    uint256 claimCounter;

    modifier validClaimId(uint256 claimId){
        require(claimId <= claimCounter && claimId > 0, "claimId not valid");
        _;
    }

    function claim(uint256 requestId) public payable returns (uint256){
        require(msg.value == claimStake, "Stake provided not correct");
        claimCounter += 1;
        uint256 newClaimId = claimCounter;
        Claim storage newClaim = claims[claimCounter];
        newClaim.requestId = requestId;
        newClaim.claimer = msg.sender;
        newClaim.termination = block.number + claimPeriod;

        emit ClaimCreated(
            newClaimId,
            requestId,
            newClaim.claimer,
            newClaim.termination
        );

        return claimCounter;
    }

    function claimSuccessful(uint256 claimId) public validClaimId(claimId) returns (bool){
        Claim memory requestedClaim = claims[claimId];
        require(requestedClaim.challenged == false, "claim was challenged");

        return block.number >= requestedClaim.termination;
    }

    function challenge(uint256 claimId) public validClaimId(claimId) payable{
        require(claims[claimId].challenged == false, "Already challenged");
        require(block.number < claims[claimId].termination, "Already successfully claimed");
        require(msg.value == claimStake, "Stake provided not correct");
        claims[claimId].challenged = true;
    }
}
