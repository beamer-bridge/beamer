// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "OpenZeppelin/openzeppelin-contracts@4.3.2/contracts/token/ERC20/IERC20.sol";
import "OpenZeppelin/openzeppelin-contracts@4.3.2/contracts/utils/math/SafeMath.sol";
import "OpenZeppelin/openzeppelin-contracts@4.3.2/contracts/utils/math/Math.sol";
import "OpenZeppelin/openzeppelin-contracts@4.3.2/contracts/access/Ownable.sol";

contract RequestManager is Ownable {
    using SafeMath for uint256;
    using Math for uint256;

    // Structs
    // TODO: check if we can use a smaller type for `targetChainId`, so that the
    // fileds can be packed into one storage slot
    struct Request {
        address sender;
        address sourceTokenAddress;
        uint256 targetChainId;
        address targetTokenAddress;
        address targetAddress;
        uint256 amount;
        bool depositWithdrawn;
        uint192 activeClaims;
        uint256 cancellationTermination;
        uint256 lpFees;
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
        uint256 requestId,
        uint256 targetChainId,
        address sourceTokenAddress,
        address targetTokenAddress,
        address targetAddress,
        uint256 amount
    );

    event RequestCancelled(
        uint256 requestId
    );

    event DepositWithdrawn(
        uint256 requestId
    );

    event ClaimCreated(
        uint256 claimId,
        uint256 requestId,
        address claimer,
        uint256 termination
    );

    event ClaimWithdrawn(
        uint256 claimId,
        uint256 requestId,
        address claimReceiver
    );

    event ClaimChallenged(
        uint256 claimId,
        address challenger
    );

    event ChallengeCountered(
        uint256 claimId,
        address leader,
        uint256 highestBid
    );

    // Constants
    uint256 public claimStake;
    uint256 public claimPeriod;
    uint256 public challengePeriod;
    uint256 public challengePeriodExtension;
    uint256 public cancellationPeriod;

    // Variables
    uint256 public requestCounter;
    uint256 public claimCounter;

    mapping (uint256 => Request) public requests;
    mapping (uint256 => Claim) public claims;
    // claimId -> Challenge
    mapping (uint256 => Challenge) public challenges;

    uint256 gasPrice = 5e9;
    uint256 serviceFeePPM = 45_000;  //4.5%

    // raisync fee tracking
    uint256 public collectedRaisyncFees = 0;

    // The optimizer should take care of eval'ing this
    function gasReimbursementFee() public view returns (uint256) {
        // TODO: update those values
        uint256 fillGas = 67105;
        uint256 claimGas = 126402;
        uint256 withdrawGas = 61954;

        return (fillGas + claimGas + withdrawGas) * gasPrice;
    }

    function lpServiceFee() public view returns (uint256) {
        return gasReimbursementFee() * serviceFeePPM / 1_000_000;
    }

    function raisyncServiceFee() public view returns (uint256) {
        return gasReimbursementFee() * serviceFeePPM / 1_000_000;
    }

    function totalFee() public view returns (uint256) {
        return gasReimbursementFee() + lpServiceFee() + raisyncServiceFee();
    }


    // Modifiers
    modifier validRequestId(uint256 requestId) {
        require(requestId <= requestCounter && requestId > 0, "requestId not valid");
        _;
    }

    modifier validClaimId(uint256 claimId) {
        require(claimId <= claimCounter && claimId > 0, "claimId not valid");
        _;
    }

    constructor(
        uint256 _claimStake,
        uint256 _claimPeriod,
        uint256 _challengePeriod,
        uint256 _challengePeriodExtension,
        uint256 _cancellationPeriod
    ) {
        claimStake = _claimStake;
        claimPeriod = _claimPeriod;
        challengePeriod = _challengePeriod;
        challengePeriodExtension = _challengePeriodExtension;
        cancellationPeriod = _cancellationPeriod;
    }

    function createRequest(
        uint256 targetChainId,
        address sourceTokenAddress,
        address targetTokenAddress,
        address targetAddress,
        uint256 amount
    )
    external payable returns (uint256)
    {
        uint256 lpFees = gasReimbursementFee() + lpServiceFee();
        uint256 raisyncFee = raisyncServiceFee();
        require(lpFees + raisyncFee == msg.value, "Wrong amount of fees sent");

        collectedRaisyncFees += raisyncFee;

        requestCounter += 1;
        Request storage newRequest = requests[requestCounter];
        newRequest.sender = msg.sender;
        newRequest.sourceTokenAddress = sourceTokenAddress;
        newRequest.targetChainId = targetChainId;
        newRequest.targetTokenAddress = targetTokenAddress;
        newRequest.targetAddress = targetAddress;
        newRequest.amount = amount;
        newRequest.depositWithdrawn = false;
        newRequest.lpFees = lpFees;

        emit RequestCreated(
            requestCounter,
            targetChainId,
            sourceTokenAddress,
            targetTokenAddress,
            targetAddress,
            amount
        );

        IERC20 token = IERC20(sourceTokenAddress);
        require(token.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        return requestCounter;
    }

    function cancelRequest(uint256 requestId) external validRequestId(requestId) {
        Request storage request = requests[requestId];

        require(request.cancellationTermination == 0, "Request already cancelled");
        require(!request.depositWithdrawn, "Deposit already withdrawn");
        require(msg.sender == request.sender, "Sender is not requester");

        request.cancellationTermination = block.timestamp + cancellationPeriod;

        emit RequestCancelled(requestId);
    }

    function withdrawCancelledRequest(uint256 requestId) external validRequestId(requestId) {
        Request storage request = requests[requestId];

        require(!request.depositWithdrawn , "Deposit already withdrawn");
        require(request.cancellationTermination > 0, "Request not cancelled");
        require(block.timestamp >= request.cancellationTermination, "Cancellation period not over yet");
        require(request.activeClaims == 0, "Active claims running");

        request.depositWithdrawn = true;

        emit DepositWithdrawn(requestId);

        IERC20 token = IERC20(request.sourceTokenAddress);
        require(token.transfer(request.sender, request.amount), "Transfer failed");
    }

    function claimRequest(uint256 requestId) external validRequestId(requestId) payable returns (uint256) {
        Request storage request = requests[requestId];

        require(!request.depositWithdrawn, "Deposit already withdrawn");
        require(msg.value == claimStake, "Stake provided not correct");

        request.activeClaims += 1;
        claimCounter += 1;

        Claim storage newClaim = claims[claimCounter];
        newClaim.requestId = requestId;
        newClaim.claimer = msg.sender;
        newClaim.withdrawn = false;
        newClaim.termination = block.timestamp + claimPeriod;

        emit ClaimCreated(
            claimCounter,
            requestId,
            newClaim.claimer,
            newClaim.termination
        );

        return claimCounter;
    }

    function challengeClaim(uint256 claimId) external validClaimId(claimId) payable {
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
        require(!claim.withdrawn, "Claim already withdrawn");

        bool depositWithdrawn = request.depositWithdrawn;

        bool claimChallenged = challenges[claimId].termination != 0;
        address claimReceiver;
        if (!claimChallenged) {
            require(depositWithdrawn || block.timestamp >= claim.termination, "Claim period not finished");
            claimReceiver = claim.claimer;
        } else {
            require(depositWithdrawn || block.timestamp >= challenges[claimId].termination, "Challenge period not finished");
            // check if l1 resolved
            Challenge storage challenge = challenges[claimId];

            bool claimerStakeBigger = challenge.claimerStake > challenge.challengerStake;
            claimReceiver = claimerStakeBigger ? claim.claimer : challenge.challenger;
        }

        claim.withdrawn = true;
        request.activeClaims -= 1;

        uint256 ethToTransfer = claimStake;
        if (!depositWithdrawn && claimReceiver == claim.claimer) {
            request.depositWithdrawn = true;
            withdraw_deposit(claimId, request, claim, claimReceiver);
        }
        // The claim is set the `withdrawn` state above, so the following effects
        // needs to happen afterwards to avoid reentrency problems
        if (claimChallenged) {
            ethToTransfer += withdraw_challenge(claimId);
        }

        (bool sent,) = claimReceiver.call{value: ethToTransfer}("");
        require(sent, "Failed to send Ether");

        return claimReceiver;
    }

    function withdraw_deposit(
        uint256 claimId,
        Request storage request,
        Claim storage claim,
        address claimReceiver
    ) private {
        emit ClaimWithdrawn(
            claimId,
            claim.requestId,
            claimReceiver
        );

        IERC20 token = IERC20(request.sourceTokenAddress);
        require(token.transfer(claimReceiver, request.amount), "Transfer failed");

        (bool sent,) = claimReceiver.call{value: request.lpFees}("");
        require(sent, "Failed to send Ether");
    }

    function withdraw_challenge(
        uint256 claimId
    ) private returns (uint256) {
        Challenge storage challenge = challenges[claimId];
        uint256 challengeStake = challenge.claimerStake + challenge.challengerStake;
        // This should never happen, but the check is cheap
        require(challengeStake >= claimStake, "Challenge stake too small");

        delete challenges[claimId];

        return challengeStake - claimStake;
    }

    function withdrawRaisyncFees() external onlyOwner {
        uint256 ethToTransfer = collectedRaisyncFees;
        collectedRaisyncFees = 0;

        (bool sent,) = msg.sender.call{value: ethToTransfer}("");
        require(sent, "Failed to send Ether");

        // As this is transferring Eth, no reentrancy is possible here
        collectedRaisyncFees = 0;
    }

    function updateGasPrice(uint256 newGasPrice) external onlyOwner {
        gasPrice = newGasPrice;
    }
}
