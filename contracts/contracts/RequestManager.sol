// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "OpenZeppelin/openzeppelin-contracts@4.5.0/contracts/token/ERC20/IERC20.sol";
import "OpenZeppelin/openzeppelin-contracts@4.5.0/contracts/token/ERC20/utils/SafeERC20.sol";
import "OpenZeppelin/openzeppelin-contracts@4.5.0/contracts/utils/math/Math.sol";
import "OpenZeppelin/openzeppelin-contracts@4.5.0/contracts/access/Ownable.sol";

import "./RaisyncUtils.sol";
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
        uint256 raisyncFee;
    }

    struct Claim {
        uint256 requestId;
        address claimer;
        uint256 claimerStake;
        address challenger;
        uint256 challengerStake;
        bool withdrawn;
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
        uint256 amount
    );

    event DepositWithdrawn(
        uint256 requestId,
        address receiver
    );

    event ClaimMade(
        uint256 requestId,
        uint256 claimId,
        address claimer,
        uint256 claimerStake,
        address challenger,
        uint256 challengerStake,
        uint256 termination,
        bytes32 fillId
    );

    event ClaimWithdrawn(
        uint256 claimId,
        uint256 requestId,
        address claimReceiver
    );

    // Constants
    uint256 public claimStake;
    uint256 public claimPeriod;
    uint256 public challengePeriod;
    uint256 public challengePeriodExtension;

    uint256 public constant minValidityPeriod = 5 minutes;
    uint256 public constant maxValidityPeriod = 52 weeks;

    // Variables
    uint256 public requestCounter;
    uint256 public claimCounter;
    ResolutionRegistry public resolutionRegistry;

    mapping (uint256 => Request) public requests;
    mapping (uint256 => Claim) public claims;

    uint256 public gasPrice = 5e9;
    uint256 serviceFeePPM = 45_000;  //4.5%

    // raisync fee tracking
    uint256 public collectedRaisyncFees = 0;

    // The optimizer should take care of eval'ing this
    function gasReimbursementFee() public view returns (uint256) {
        uint256 fillGas = 67105;
        uint256 claimGas = 154634;
        uint256 withdrawGas = 64081;

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
        address _resolutionRegistry
    ) {
        claimStake = _claimStake;
        claimPeriod = _claimPeriod;
        challengePeriod = _challengePeriod;
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
    )
    external payable returns (uint256)
    {
        uint256 lpFee = gasReimbursementFee() + lpServiceFee();
        uint256 raisyncFee = raisyncServiceFee();
        require(lpFee + raisyncFee == msg.value, "Wrong amount of fees sent");
        require(validityPeriod >= minValidityPeriod, "Validity period too short");
        require(validityPeriod <= maxValidityPeriod, "Validity period too long");

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
        newRequest.raisyncFee = raisyncFee;

        emit RequestCreated(
            requestCounter,
            targetChainId,
            sourceTokenAddress,
            targetTokenAddress,
            targetAddress,
            amount
        );

        IERC20 token = IERC20(sourceTokenAddress);
        token.safeTransferFrom(msg.sender, address(this), amount);

        return requestCounter;
    }

    function withdrawExpiredRequest(uint256 requestId) external validRequestId(requestId) {
        Request storage request = requests[requestId];

        require(request.depositReceiver == address(0), "Deposit already withdrawn");
        require(block.timestamp >= request.validUntil, "Request not expired yet");
        require(request.activeClaims == 0, "Active claims running");

        request.depositReceiver = request.sender;

        emit DepositWithdrawn(requestId, request.sender);

        IERC20 token = IERC20(request.sourceTokenAddress);
        token.safeTransfer(request.sender, request.amount);

        (bool sent,) = request.sender.call{value: request.lpFee + request.raisyncFee}("");
        require(sent, "Failed to send Ether");
    }

    function claimRequest(uint256 requestId, bytes32 fillId)
        external validRequestId(requestId) payable returns (uint256)
    {
        Request storage request = requests[requestId];

        require(block.timestamp < request.validUntil, "Request expired");
        require(request.depositReceiver == address(0), "Deposit already withdrawn");
        require(msg.value == claimStake, "Invalid stake amount");

        request.activeClaims += 1;
        claimCounter += 1;

        Claim storage claim = claims[claimCounter];
        claim.requestId = requestId;
        claim.claimer = msg.sender;
        claim.claimerStake = claimStake;
        claim.challenger = address(0);
        claim.challengerStake = 0;
        claim.withdrawn = false;
        claim.termination = block.timestamp + claimPeriod;
        claim.fillId = fillId;

        emit ClaimMade(
            requestId,
            claimCounter,
            claim.claimer,
            claim.claimerStake,
            claim.challenger,
            claim.challengerStake,
            claim.termination,
            fillId
        );

        return claimCounter;
    }

    function challengeClaim(uint256 claimId) external validClaimId(claimId) payable {
        Claim storage claim = claims[claimId];
        require(block.timestamp < claim.termination, "Claim expired");

        address nextActor;
        uint256 minValue;
        uint256 periodExtension;

        if (claim.claimerStake > claim.challengerStake) {
            if (claim.challenger == address(0)) {
                require(claim.claimer != msg.sender, "Cannot challenge own claim");
                claim.challenger = msg.sender;
                periodExtension = challengePeriod;
            } else {
                periodExtension = challengePeriodExtension;
            }
            nextActor = claim.challenger;
            minValue = claim.claimerStake - claim.challengerStake;
        } else {
            nextActor = claim.claimer;
            minValue = claim.challengerStake - claim.claimerStake;
        }

        require(msg.sender == nextActor, "Not eligible to outbid");
        require(msg.value > minValue, "Not enough stake provided");

        if (nextActor == claim.claimer) {
            claim.claimerStake += msg.value;
        } else {
            claim.challengerStake += msg.value;
        }

        claim.termination = Math.max(claim.termination, block.timestamp + periodExtension);

        emit ClaimMade(
            claim.requestId,
            claimId,
            claim.claimer,
            claim.claimerStake,
            claim.challenger,
            claim.challengerStake,
            claim.termination,
            claim.fillId
        );
    }

    function withdraw(uint256 claimId) external validClaimId(claimId) returns (address) {
        Claim storage claim = claims[claimId];
        Request storage request = requests[claim.requestId];
        require(!claim.withdrawn, "Claim already withdrawn");

        bytes32 fillHash = RaisyncUtils.createFillHash(
                claim.requestId,
                block.chainid,
                request.targetChainId,
                request.targetTokenAddress,
                request.targetAddress,
                request.amount,
                claim.fillId
            );

        address claimReceiver;
        address depositReceiver = request.depositReceiver;

        // Priority list for claim settlement, settlement according to
        // 1) resolutionRegistry entry, the filler
        // 2) depositReceiver, the address that withdrew the deposit with a valid claim
        // 3) claim properties
        address filler = resolutionRegistry.fillers(fillHash);
        if(filler == address(0)) {
            filler = depositReceiver;
        }

        if (filler == address(0)) {
            // Claim resolution via claim properties
            require(block.timestamp >= claim.termination, "Claim period not finished");
            claimReceiver = claim.claimerStake > claim.challengerStake ? claim.claimer : claim.challenger;
        } else if (filler != claim.claimer) {
            // Claim resolution via 1) or 2) but claim is invalid (challenger wins challenge)
            claimReceiver = claim.challenger;
        } else {
            // Claim resolution via 1) or 2) and claim is valid (claimer wins challenge)
            claimReceiver = claim.claimer;
        }

        claim.withdrawn = true;
        request.activeClaims -= 1;

        if (depositReceiver == address(0) && claimReceiver == claim.claimer) {
            withdrawDeposit(request, claim, claimReceiver);
        }

        // The claim is set the `withdrawn` state above, so the following effects
        // needs to happen afterwards to avoid reentrency problems
        uint256 ethToTransfer = claim.claimerStake + claim.challengerStake;

        // The unlikely event is possible that a false claim has no challenger
        // If it is known that the claim is false then the claim stake goes to the platform
        if(claimReceiver != address(0)) {
            (bool sent,) = claimReceiver.call{value: ethToTransfer}("");
            require(sent, "Failed to send Ether");
        }
        else {
            collectedRaisyncFees += ethToTransfer;
            claimReceiver = address(this);
        }

        emit ClaimWithdrawn(
            claimId,
            claim.requestId,
            claimReceiver
        );

        return claimReceiver;
    }

    function withdrawDeposit(
        Request storage request,
        Claim storage claim,
        address depositReceiver
    ) private {
        collectedRaisyncFees += request.raisyncFee;

        emit DepositWithdrawn(
            claim.requestId,
            depositReceiver
        );

        IERC20 token = IERC20(request.sourceTokenAddress);
        token.safeTransfer(depositReceiver, request.amount);
        request.depositReceiver = depositReceiver;

        (bool sent,) = depositReceiver.call{value: request.lpFee}("");
        require(sent, "Failed to send Ether");
    }

    function withdrawRaisyncFees() external onlyOwner {
        require(collectedRaisyncFees > 0, "Zero fees available");

        uint256 feeAmount = collectedRaisyncFees;
        collectedRaisyncFees = 0;

        (bool sent,) = msg.sender.call{value: feeAmount}("");
        require(sent, "Failed to send Ether");
    }

    function updateFeeData(uint256 newGasPrice, uint256 newServiceFeePPM) external onlyOwner {
        gasPrice = newGasPrice;
        serviceFeePPM = newServiceFeePPM;
    }
}
