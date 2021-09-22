// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;


contract ClaimManager is Ownable{

    struct Claim{
        uint256 requestId;
        uint256 claimer;
        uint256 termination;
        uint256 challenged;
    }

    event ClaimCreated(
        uint256 claimId,
        uint256 requestId,
        address claimer,
        uint256 termination
    );

    uint256 claimStake;
    uint256 claimPeriod;
    mapping (uint256 => Claim) claims;
    uint256 claimCounter;

    modifier validClaimId(uint256 claimId){
        require(claimId <= claimCounter, claimId > 0, "claimId not valid");
        require(claims[claimId].isValue, "claim for claimId does not exist");
        _;
    }

    function ClaimManager(){
    }

    function claim(uint256 requestId) payable returns (uint256){
        require(msg.value == claimStake, "Stake provided not correct");
        claimCounter += 1;
        Claim storage claim = claims[claim_counter];
        claim.requestId = requestId;
        claim.claimer = msg.sender;
        claim.termination = block.number + claimPeriod;
        return claimCounter;
    }

    function claimSuccessful(uint256 claimId) validClaimId returns (bool){
        claim = claims[claimId];
        require(claims[claimId].challenge == false, "claim was challenged");

        return block.number >= claim.termination;
    }

    function challenge(uint256 claimId) validClaimId payable{
        claim = claims[claimId];
        require(claims[claimId].challenge == false, "Already challenged");
        require(block.number < claim.termination, "Already successfully claimed");
        require(msg.value == claimStake, "Stake provided not correct");
        claims[claimId].challenged = true;
    }
}
