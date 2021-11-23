// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "OpenZeppelin/openzeppelin-contracts@4.3.2/contracts/token/ERC20/IERC20.sol";
import "OpenZeppelin/openzeppelin-contracts@4.3.2/contracts/utils/math/SafeMath.sol";
import "OpenZeppelin/openzeppelin-contracts@4.3.2/contracts/utils/math/Math.sol";

contract RequestManager {
    using SafeMath for uint256;
    using Math for uint256;

    // Structs
    struct Request {
        address sourceTokenAddress;
        uint256 targetChainId;
        address targetTokenAddress;
        address targetAddress;
        uint256 amount;
    }

    struct Claim {
        uint256 requestId;
        address claimer;
        bool withdrawn;
        uint256 termination;
    }

    struct Challenge {
        address challenger;
        uint256 challengerStake;
        uint256 claimerStake;
        uint256 termination;
    }

    // Events
    event RequestCreated(
        uint256 indexed requestId,
        uint256 targetChainId,
        address targetTokenAddress,
        address targetAddress,
        uint256 amount
    );

    event ClaimCreated(
        uint256 indexed claimId,
        uint256 requestId,
        address claimer,
        uint256 termination
    );

    event ClaimWithdrawn(
        uint256 indexed claimId,
        uint256 requestId,
        address claimeReceiver
    );

    event ClaimChallenged(
        uint256 indexed claimId,
        address challenger
    );

    event ChallengeCountered(
        uint256 indexed claimId,
        address leader,
        uint256 highestBid
    );

    // Constants
    uint256 public claimStake;
    uint256 public claimPeriod;
    uint256 public challengePeriod;
    uint256 public challengePeriodExtension;

    // Variables
    uint256 public requestCounter;
    uint256 public claimCounter;
    mapping (uint256 => Request) public requests;
    mapping (uint256 => Claim) public claims;
    mapping (uint256 => Challenge) public challenges;

    // Modifiers
    modifier validClaimId(uint256 claimId) {
        require(claimId <= claimCounter && claimId > 0, "claimId not valid");
        _;
    }

    constructor(
        uint256 _claimStake,
        uint256 _claimPeriod,
        uint256 _challengePeriod,
        uint256 _challengePeriodExtension
    ) {
        claimStake = _claimStake;
        claimPeriod = _claimPeriod;
        challengePeriod = _challengePeriod;
        challengePeriodExtension = _challengePeriodExtension;
    }

    function request(
        uint256 targetChainId,
        address sourceTokenAddress,
        address targetTokenAddress,
        address targetAddress,
        uint256 amount
    )
    external returns (uint256)
    {
        requestCounter += 1;
        uint256 requestId = requestCounter;

        Request storage newRequest = requests[requestId];
        newRequest.sourceTokenAddress = sourceTokenAddress;
        newRequest.targetChainId = targetChainId;
        newRequest.targetTokenAddress = targetTokenAddress;
        newRequest.targetAddress = targetAddress;
        newRequest.amount = amount;

        emit RequestCreated(
            requestId,
            targetChainId,
            targetTokenAddress,
            targetAddress,
            amount
        );

        IERC20 token = IERC20(sourceTokenAddress);
        require(token.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        return requestId;
    }

    function claimRequest(uint256 requestId) external payable returns (uint256) {
        require(msg.value == claimStake, "Stake provided not correct");

        claimCounter += 1;
        uint256 newClaimId = claimCounter;

        Claim storage newClaim = claims[claimCounter];
        newClaim.requestId = requestId;
        newClaim.claimer = msg.sender;
        newClaim.withdrawn = false;
        newClaim.termination = block.timestamp + claimPeriod;

        emit ClaimCreated(
            newClaimId,
            requestId,
            newClaim.claimer,
            newClaim.termination
        );

        return claimCounter;
    }

    function challengeClaim(uint256 claimId) external validClaimId(claimId) payable{
        Challenge storage challenge = challenges[claimId];

        require(challenge.challenger == address(0), "Already challenged");
        require(block.timestamp < claims[claimId].termination, "Already claimed successfully");
        require(msg.value > claimStake, "Not enough funds provided");

        challenge.challenger = msg.sender;
        challenge.challengerStake = msg.value;
        challenge.claimerStake = claimStake;
        challenge.termination = block.timestamp + challengePeriod;

        emit ClaimChallenged(
            claimId,
            msg.sender
        );
    }

    function counterChallenge(uint256 claimId) external validClaimId(claimId) payable {
        Claim storage claim = claims[claimId];
        Challenge storage challenge = challenges[claimId];
        require(challenge.challenger != address(0), "Claim not yet challenged");
        require(msg.sender == claim.claimer || msg.sender == challenge.challenger, "Already challenged by another address");
        require(block.timestamp < challenge.termination, "Challenge period finished");

        bool claimerStakeBigger = challenge.claimerStake > challenge.challengerStake;
        address nextActor = claimerStakeBigger ? challenge.challenger : claim.claimer;
        require(msg.sender == nextActor, "Not eligible to outbid");

        uint256 minStake = claimerStakeBigger ? challenge.claimerStake - challenge.challengerStake : challenge.challengerStake - challenge.claimerStake;
        require(msg.value > minStake, "Not enough funds provided");

        if (msg.sender == claim.claimer) {
            challenge.claimerStake += msg.value;
        } else {
            challenge.challengerStake += msg.value;
        }

        challenge.termination = Math.max(challenge.termination, block.timestamp + challengePeriodExtension);

        emit ChallengeCountered(
            claimId,
            msg.sender,
            Math.max(challenge.challengerStake, challenge.claimerStake)
        );
    }

    function withdraw(uint256 claimId) external validClaimId(claimId) returns (address) {
        Claim storage claim = claims[claimId];
        Request storage request = requests[claim.requestId];
        require(!claim.withdrawn, "Already withdrawn");

        bool claimChallenged = challenges[claimId].termination != 0;
        address claimReceiver;
        if (!claimChallenged) {
            require(block.timestamp >= claim.termination, "Claim period not finished");
            claimReceiver = claim.claimer;
        } else {
            require(block.timestamp >= challenges[claimId].termination, "Challenge period not finished");
            // check if l1 resolved
            Challenge storage challenge = challenges[claimId];

            bool claimerStakeBigger = challenge.claimerStake > challenge.challengerStake;
            claimReceiver = claimerStakeBigger ? claim.claimer : challenge.challenger;
        }

        withdraw_claim(claimId, request, claim, claimReceiver);
        // The claim is set the `withdrawn` state above, so the following effects
        // needs to happen afterwards to avoid reentrency problems
        if (claimChallenged) {
            withdraw_challenge(claimId, claim, claimReceiver);
        }

        return claimReceiver;
    }

    function withdraw_claim(
        uint256 claimId,
        Request storage request,
        Claim storage claim,
        address claimReceiver
    ) private {
        claim.withdrawn = true;

        emit ClaimWithdrawn(
            claimId,
            claim.requestId,
            claimReceiver
        );

        IERC20 token = IERC20(request.sourceTokenAddress);
        require(token.transfer(claimReceiver, request.amount), "Transfer failed");
    }

    function withdraw_challenge(
        uint256 claimId,
        Claim storage claim,
        address claimReceiver
    ) private {
        Challenge storage challenge = challenges[claimId];
        uint256 challengeStake = challenge.claimerStake + challenge.challengerStake;

        (bool sent, bytes memory data) = claimReceiver.call{value: challengeStake}("");
        require(sent, "Failed to send Ether");

        delete challenges[claimId];
    }
}
