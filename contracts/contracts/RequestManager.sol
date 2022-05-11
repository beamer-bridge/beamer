// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "OpenZeppelin/openzeppelin-contracts@4.5.0/contracts/token/ERC20/IERC20.sol";
import "OpenZeppelin/openzeppelin-contracts@4.5.0/contracts/token/ERC20/utils/SafeERC20.sol";
import "OpenZeppelin/openzeppelin-contracts@4.5.0/contracts/utils/math/Math.sol";
import "OpenZeppelin/openzeppelin-contracts@4.5.0/contracts/access/Ownable.sol";

import "./BeamerUtils.sol";
import "./ResolutionRegistry.sol";

contract RequestManager is Ownable {
    using Math for uint256;
    using SafeERC20 for IERC20;

    // Structs
    // TODO: check if we can use a smaller type for `targetChainId`, so that the
    // fields can be packed into one storage slot
    struct Request {
        address sender;
        address sourceTokenAddress;
        uint256 targetChainId;
        address targetTokenAddress;
        address targetAddress;
        uint256 amount;
        address depositReceiver;
        uint192 activeClaims;
        uint256 validUntil;
        uint256 lpFee;
        uint256 protocolFee;
    }

    struct Claim {
        uint256 requestId;
        address claimer;
        uint256 claimerStake;
        mapping(address => uint256) challengersStakes;
        address lastChallenger;
        uint256 challengerStakeTotal;
        uint256 withdrawnAmount;
        uint256 termination;
        bytes32 fillId;
    }

    // Events
    event RequestCreated(
        uint256 requestId,
        uint256 targetChainId,
        address sourceTokenAddress,
        address targetTokenAddress,
        address targetAddress,
        uint256 amount,
        uint256 validUntil
    );

    event DepositWithdrawn(uint256 requestId, address receiver);

    event ClaimMade(
        uint256 indexed requestId,
        uint256 claimId,
        address claimer,
        uint256 claimerStake,
        address lastChallenger,
        uint256 challengerStakeTotal,
        uint256 termination,
        bytes32 fillId
    );

    event ClaimWithdrawn(
        uint256 claimId,
        uint256 indexed requestId,
        address claimReceiver
    );

    // Constants
    uint256 public claimStake;
    uint256 public claimPeriod;
    uint256 public challengePeriodExtension;

    uint256 public constant MIN_VALIDITY_PERIOD = 5 minutes;
    uint256 public constant MAX_VALIDITY_PERIOD = 52 weeks;

    // Variables
    uint256 public requestCounter;
    uint256 public claimCounter;
    ResolutionRegistry public resolutionRegistry;

    mapping(uint256 => uint256) public finalizationTimes; // target rollup chain id => finalization time

    mapping(uint256 => Request) public requests;
    mapping(uint256 => Claim) public claims;

    uint256 public minLpFee = 5 ether; // 5e18
    uint256 public lpFeePPM = 1_000; // 0.1% of the token amount being transferred
    uint256 public protocolFeePPM = 0; // 0% of the token amount being transferred

    // Protocol fee tracking: ERC20 token address => amount
    mapping(address => uint256) public collectedProtocolFees;

    function lpFee(uint256 amount) public view returns (uint256) {
        return Math.max(minLpFee, (amount * lpFeePPM) / 1_000_000);
    }

    function protocolFee(uint256 amount) public view returns (uint256) {
        return (amount * protocolFeePPM) / 1_000_000;
    }

    function totalFee(uint256 amount) public view returns (uint256) {
        return lpFee(amount) + protocolFee(amount);
    }

    // Modifiers
    modifier validRequestId(uint256 requestId) {
        require(
            requestId <= requestCounter && requestId > 0,
            "requestId not valid"
        );
        _;
    }

    modifier validClaimId(uint256 claimId) {
        require(claimId <= claimCounter && claimId > 0, "claimId not valid");
        _;
    }

    constructor(
        uint256 _claimStake,
        uint256 _claimPeriod,
        uint256 _challengePeriodExtension,
        address _resolutionRegistry
    ) {
        claimStake = _claimStake;
        claimPeriod = _claimPeriod;
        challengePeriodExtension = _challengePeriodExtension;
        resolutionRegistry = ResolutionRegistry(_resolutionRegistry);
    }

    function createRequest(
        uint256 targetChainId,
        address sourceTokenAddress,
        address targetTokenAddress,
        address targetAddress,
        uint256 amount,
        uint256 validityPeriod
    ) external payable returns (uint256) {
        require(
            finalizationTimes[targetChainId] != 0,
            "Target rollup not supported"
        );
        require(
            validityPeriod >= MIN_VALIDITY_PERIOD,
            "Validity period too short"
        );
        require(
            validityPeriod <= MAX_VALIDITY_PERIOD,
            "Validity period too long"
        );

        IERC20 token = IERC20(sourceTokenAddress);

        uint256 lpFee = lpFee(amount);
        uint256 protocolFee = protocolFee(amount);
        uint256 totalTokenAmount = amount + lpFee + protocolFee;

        require(
            token.allowance(msg.sender, address(this)) >= totalTokenAmount,
            "Insufficient allowance"
        );

        requestCounter += 1;
        Request storage newRequest = requests[requestCounter];
        newRequest.sender = msg.sender;
        newRequest.sourceTokenAddress = sourceTokenAddress;
        newRequest.targetChainId = targetChainId;
        newRequest.targetTokenAddress = targetTokenAddress;
        newRequest.targetAddress = targetAddress;
        newRequest.amount = amount;
        newRequest.depositReceiver = address(0);
        newRequest.validUntil = block.timestamp + validityPeriod;
        newRequest.lpFee = lpFee;
        newRequest.protocolFee = protocolFee;

        emit RequestCreated(
            requestCounter,
            targetChainId,
            sourceTokenAddress,
            targetTokenAddress,
            targetAddress,
            amount,
            newRequest.validUntil
        );

        token.safeTransferFrom(msg.sender, address(this), totalTokenAmount);

        return requestCounter;
    }

    function withdrawExpiredRequest(uint256 requestId)
        external
        validRequestId(requestId)
    {
        Request storage request = requests[requestId];

        require(
            request.depositReceiver == address(0),
            "Deposit already withdrawn"
        );
        require(
            block.timestamp >= request.validUntil,
            "Request not expired yet"
        );
        require(request.activeClaims == 0, "Active claims running");

        request.depositReceiver = request.sender;

        emit DepositWithdrawn(requestId, request.sender);

        IERC20 token = IERC20(request.sourceTokenAddress);
        token.safeTransfer(
            request.sender,
            request.amount + request.lpFee + request.protocolFee
        );
    }

    function claimRequest(uint256 requestId, bytes32 fillId)
        external
        payable
        validRequestId(requestId)
        returns (uint256)
    {
        Request storage request = requests[requestId];

        require(block.timestamp < request.validUntil, "Request expired");
        require(
            request.depositReceiver == address(0),
            "Deposit already withdrawn"
        );
        require(msg.value == claimStake, "Invalid stake amount");

        request.activeClaims += 1;
        claimCounter += 1;

        Claim storage claim = claims[claimCounter];
        claim.requestId = requestId;
        claim.claimer = msg.sender;
        claim.claimerStake = claimStake;
        claim.lastChallenger = address(0);
        claim.challengerStakeTotal = 0;
        claim.withdrawnAmount = 0;
        claim.termination = block.timestamp + claimPeriod;
        claim.fillId = fillId;

        emit ClaimMade(
            requestId,
            claimCounter,
            claim.claimer,
            claim.claimerStake,
            claim.lastChallenger,
            claim.challengerStakeTotal,
            claim.termination,
            fillId
        );

        return claimCounter;
    }

    function challengeClaim(uint256 claimId)
        external
        payable
        validClaimId(claimId)
    {
        Claim storage claim = claims[claimId];
        Request storage request = requests[claim.requestId];
        require(block.timestamp < claim.termination, "Claim expired");

        address nextActor;
        uint256 minValue;
        uint256 periodExtension = challengePeriodExtension;
        uint256 claimerStake = claim.claimerStake;
        uint256 challengerStakeTotal = claim.challengerStakeTotal;

        if (claimerStake > challengerStakeTotal) {
            if (challengerStakeTotal == 0) {
                periodExtension += finalizationTimes[request.targetChainId];
            }
            require(claim.claimer != msg.sender, "Cannot challenge own claim");
            nextActor = msg.sender;
            minValue = claimerStake - challengerStakeTotal + 1;
        } else {
            nextActor = claim.claimer;
            minValue = challengerStakeTotal - claimerStake + claimStake;
        }

        require(msg.sender == nextActor, "Not eligible to outbid");
        require(msg.value >= minValue, "Not enough stake provided");

        if (nextActor == claim.claimer) {
            claim.claimerStake += msg.value;
        } else {
            claim.lastChallenger = msg.sender;
            claim.challengersStakes[msg.sender] += msg.value;
            claim.challengerStakeTotal += msg.value;
        }

        claim.termination = Math.max(
            claim.termination,
            block.timestamp + periodExtension
        );
        uint256 minimumTermination = block.timestamp + challengePeriodExtension;
        require(
            claim.termination >= minimumTermination,
            "Claim termination did not increase enough"
        );

        emit ClaimMade(
            claim.requestId,
            claimId,
            claim.claimer,
            claim.claimerStake,
            claim.lastChallenger,
            claim.challengerStakeTotal,
            claim.termination,
            claim.fillId
        );
    }

    function withdraw(uint256 claimId)
        external
        validClaimId(claimId)
        returns (address)
    {
        Claim storage claim = claims[claimId];
        Request storage request = requests[claim.requestId];

        (address claimReceiver, uint256 ethToTransfer) = resolveClaim(claimId);

        if (claim.challengersStakes[claimReceiver] > 0) {
            //Re-entrancy protection
            claim.challengersStakes[claimReceiver] = 0;
        }

        // First time withdraw is called, remove it from active claims
        if (claim.withdrawnAmount == 0) {
            request.activeClaims -= 1;
        }
        claim.withdrawnAmount += ethToTransfer;
        require(
            claim.withdrawnAmount <=
                claim.claimerStake + claim.challengerStakeTotal,
            "Amount to withdraw too large"
        );

        (bool sent, ) = claimReceiver.call{value: ethToTransfer}("");
        require(sent, "Failed to send Ether");

        emit ClaimWithdrawn(claimId, claim.requestId, claimReceiver);

        if (
            request.depositReceiver == address(0) &&
            claimReceiver == claim.claimer
        ) {
            withdrawDeposit(request, claim, claimReceiver);
        }

        return claimReceiver;
    }

    function resolveClaim(uint256 claimId)
        private
        view
        returns (address, uint256)
    {
        Claim storage claim = claims[claimId];
        Request storage request = requests[claim.requestId];
        uint256 claimerStake = claim.claimerStake;
        uint256 challengerStakeTotal = claim.challengerStakeTotal;
        require(
            claim.withdrawnAmount < claimerStake + challengerStakeTotal,
            "Claim already withdrawn"
        );

        bytes32 fillHash = BeamerUtils.createFillHash(
            claim.requestId,
            block.chainid,
            request.targetChainId,
            request.targetTokenAddress,
            request.targetAddress,
            request.amount,
            claim.fillId
        );

        bool claimValid = false;
        address depositReceiver = request.depositReceiver;

        // Priority list for validity check of claim
        // Claim is valid if either
        // 1) ResolutionRegistry entry in fillers, claimer is the filler
        // 2) ResolutionRegistry entry in invalidFillHashes, claim is invalid
        // 3) DepositReceiver, the claimer is the address that withdrew the deposit with another claim
        // 4) Claim properties, claim terminated and claimer has the highest stake
        address filler = resolutionRegistry.fillers(fillHash);

        if (filler == address(0)) {
            filler = depositReceiver;
        }

        if (resolutionRegistry.invalidFillHashes(fillHash)) {
            // Claim resolution via 2)
            claimValid = false;
        } else if (filler != address(0)) {
            // Claim resolution via 1) or 3)
            claimValid = filler == claim.claimer;
        } else {
            // Claim resolution via 4)
            require(
                block.timestamp >= claim.termination,
                "Claim period not finished"
            );
            claimValid = claimerStake > challengerStakeTotal;
        }

        // Calculate withdraw scheme for claim stakes
        uint256 ethToTransfer;
        address claimReceiver;

        if (claimValid) {
            // If claim is valid, all stakes go to the claimer
            ethToTransfer = claimerStake + challengerStakeTotal;
            claimReceiver = claim.claimer;
        } else if (challengerStakeTotal > 0) {
            // If claim is invalid, partial withdrawal by the sender
            ethToTransfer = 2 * claim.challengersStakes[msg.sender];
            claimReceiver = msg.sender;

            require(ethToTransfer > 0, "Challenger has nothing to withdraw");
        } else {
            // The unlikely event is possible that a false claim has no challenger
            // If it is known that the claim is false then the claim stake goes to the platform
            ethToTransfer = claimerStake;
            claimReceiver = owner();
        }

        // If the challenger wins and is the last challenger, he gets either
        // twice his stake plus the excess stake (if the claimer was winning), or
        // twice his stake minus the difference between the claimer and challenger stakes (if the claimer was losing)
        if (msg.sender == claim.lastChallenger) {
            if (claimerStake > challengerStakeTotal) {
                ethToTransfer += (claimerStake - challengerStakeTotal);
            } else {
                ethToTransfer -= (challengerStakeTotal - claimerStake);
            }
        }

        return (claimReceiver, ethToTransfer);
    }

    function withdrawDeposit(
        Request storage request,
        Claim storage claim,
        address depositReceiver
    ) private {
        emit DepositWithdrawn(claim.requestId, depositReceiver);

        collectedProtocolFees[request.sourceTokenAddress] += request
            .protocolFee;

        IERC20 token = IERC20(request.sourceTokenAddress);
        token.safeTransfer(depositReceiver, request.amount + request.lpFee);
        request.depositReceiver = depositReceiver;
    }

    function withdrawProtocolFees(address tokenAddress, address recipient)
        external
        onlyOwner
    {
        uint256 amount = collectedProtocolFees[tokenAddress];
        require(amount > 0, "Protocol fee is zero");
        collectedProtocolFees[tokenAddress] = 0;

        IERC20 token = IERC20(tokenAddress);
        token.safeTransfer(recipient, amount);
    }

    function updateFeeData(
        uint256 newProtocolFeePPM,
        uint256 newLpFeePPM,
        uint256 newMinLpFee
    ) external onlyOwner {
        protocolFeePPM = newProtocolFeePPM;
        lpFeePPM = newLpFeePPM;
        minLpFee = newMinLpFee;
    }

    function setFinalizationTime(
        uint256 targetChainId,
        uint256 finalizationTime
    ) external onlyOwner {
        require(
            finalizationTime > 0,
            "Finalization time must be greater than 0"
        );
        finalizationTimes[targetChainId] = finalizationTime;
    }
}
