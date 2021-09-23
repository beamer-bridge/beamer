// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "OpenZeppelin/openzeppelin-contracts@4.3.2/contracts/access/Ownable.sol";
import "OpenZeppelin/openzeppelin-contracts@4.3.2/contracts/utils/math/SafeMath.sol";
import "OpenZeppelin/openzeppelin-contracts@4.3.2/contracts/utils/math/Math.sol";


contract ClaimManager is Ownable{

    using SafeMath for uint256;
    using Math for uint256;

    struct Claim{
        uint256 requestId;
        address claimer;
        uint256 termination;
    }

    struct Challenge{
        address challenger;
        uint256 challenger_stake;
        uint256 claimer_stake;
        uint256 termination;
    }

    event ClaimCreated(
        uint256 indexed claimId,
        uint256 requestId,
        address claimer,
        uint256 termination
    );

    event ClaimChallenged(
        uint256 claimId,
        address challenger
    );

    uint256 public claimStake;
    uint256 public claimPeriod;
    mapping (uint256 => Claim) public claims;
    uint256 public claimCounter;

    uint256 public challengePeriod;
    uint256 public challengeExtensionTime;
    mapping (uint256 => Challenge) public challenges;



    modifier validClaimId(uint256 claimId){
        require(claimId <= claimCounter && claimId > 0, "claimId not valid");
        _;
    }

    modifier can_challenge(uint256 claimId){
        uint256 termination = Math.max(claims[claimId].termination, challenges[claimId].termination);

        require(termination > block.number, "Already terminated");
        Claim storage claim = claims[claimId];
        Challenge storage challenge = challenges[claimId];

        if(challenge.challenger == address(0)){
            require(challenge.challenger != claims[claimId].claimer, "Cannot challenge own claim!");
        }
        else{
            require(msg.sender == claim.claimer || msg.sender == challenge.challenger,"Already challenged by another address");
        }

        uint256 own_stake;
        uint256 others_stake;

        if(msg.sender == claim.claimer){
            uint256 own_stake = Math.max(challenge.claimer_stake, claimStake);
            uint256 others_stake = challenge.challenger_stake;
        }
        else{
            uint256 own_stake = challenge.challenger_stake;
            uint256 others_stake = Math.max(challenge.claimer_stake, claimStake);
        }

        require(others_stake > own_stake, "Cannot challenge because address is already leading");
        require(msg.value + own_stake > others_stake, "not enough stake");
        _;
    }

    function claimRequest(uint256 requestId) public payable returns (uint256){
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
        Claim storage requestedClaim = claims[claimId];
        require(challenges[claimId].termination == 0 , "claim was challenged");

        return block.number >= requestedClaim.termination;
    }

    function challengeClaim(uint256 claimId) public validClaimId(claimId) can_challenge(claimId) payable{

        Challenge storage _challenge = challenges[claimId];

        if(_challenge.challenger == address(0))
            _initChallenge(claimId);



        if(msg.sender == claims[claimId].claimer){
            _challenge.claimer_stake += msg.value;
        }
        else {
            _challenge.challenger_stake += msg.value;
        }

        _challenge.termination = Math.max(block.number + challengeExtensionTime, _challenge.termination);

        emit ClaimChallenged(
            claimId,
            msg.sender
        );
    }

    function _initChallenge(uint256 claimId) internal {
        Challenge storage challenge = challenges[claimId];
        challenge.challenger = msg.sender;
        challenge.claimer_stake = claimStake;
        challenge.termination = challengePeriod;

    }
}
