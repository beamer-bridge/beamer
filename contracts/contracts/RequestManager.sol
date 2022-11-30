// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "OpenZeppelin/openzeppelin-contracts@4.7.3/contracts/token/ERC20/IERC20.sol";
import "OpenZeppelin/openzeppelin-contracts@4.7.3/contracts/token/ERC20/utils/SafeERC20.sol";
import "OpenZeppelin/openzeppelin-contracts@4.7.3/contracts/utils/math/Math.sol";
import "OpenZeppelin/openzeppelin-contracts@4.7.3/contracts/access/Ownable.sol";

import "./BeamerUtils.sol";
import "./RestrictedCalls.sol";
import "./LpWhitelist.sol";

/// The request manager.
///
/// This contract is responsible for keeping track of transfer requests,
/// implementing the rules of the challenge game and holding deposited
/// tokens until they are withdrawn.
/// The information passed by L1 resolution will be stored with the respective requests.
///
/// It is the only contract that agents need to interact with on the source chain.
/// .. note::
///
///   The functions resolveRequest and invalidateFill can only be called by
///   the :sol:contract:`Resolver` contract, via a chain-dependent messenger contract.
contract RequestManager is Ownable, LpWhitelist, RestrictedCalls {
    using Math for uint256;
    using SafeERC20 for IERC20;

    // Structs
    // TODO: check if we can use a smaller type for `targetChainId`, so that the
    // fields can be packed into one storage slot
    struct Request {
        address sender;
        address sourceTokenAddress;
        uint256 targetChainId;
        uint256 amount;
        uint32 validUntil;
        uint96 lpFee;
        uint96 protocolFee;
        uint32 activeClaims;
        uint256 withdrawClaimId;
        address filler;
        bytes32 fillId;
        mapping(bytes32 => bool) invalidFillIds;
    }

    struct Claim {
        bytes32 requestId;
        address claimer;
        uint256 claimerStake;
        mapping(address => uint256) challengersStakes;
        address lastChallenger;
        uint256 challengerStakeTotal;
        uint256 withdrawnAmount;
        uint256 termination;
        bytes32 fillId;
    }

    struct Token {
        uint256 transferLimit;
        uint96 minLpFee;
        uint32 lpFeePPM;
        uint32 protocolFeePPM;
        uint96 collectedProtocolFees;
    }

    // Events

    /// Emitted when a new request has been created.
    ///
    /// .. seealso:: :sol:func:`createRequest`
    event RequestCreated(
        bytes32 indexed requestId,
        uint256 targetChainId,
        address sourceTokenAddress,
        address targetTokenAddress,
        address targetAddress,
        uint256 amount,
        uint256 nonce,
        uint32 validUntil
    );

    /// Emitted when the token deposit for request ``requestId`` has been
    /// transferred to the ``receiver``.
    ///
    /// This can happen in two cases:
    ///
    ///  * the request expired and the request submitter called :sol:func:`withdrawExpiredRequest`
    ///  * a claim related to the request has been resolved successfully in favor of the claimer
    ///
    /// .. seealso:: :sol:func:`withdraw` :sol:func:`withdrawExpiredRequest`
    event DepositWithdrawn(bytes32 requestId, address receiver);

    /// Emitted when a claim or a counter-claim (challenge) has been made.
    ///
    /// .. seealso:: :sol:func:`claimRequest` :sol:func:`challengeClaim`
    event ClaimMade(
        bytes32 indexed requestId,
        uint256 claimId,
        address claimer,
        uint256 claimerStake,
        address lastChallenger,
        uint256 challengerStakeTotal,
        uint256 termination,
        bytes32 fillId
    );

    /// Emitted when staked native tokens tied to a claim have been withdrawn.
    ///
    /// This can only happen when the claim has been resolved and the caller
    /// of :sol:func:`withdraw` is allowed to withdraw their stake.
    ///
    /// .. seealso:: :sol:func:`withdraw`
    event ClaimStakeWithdrawn(
        uint256 claimId,
        bytes32 indexed requestId,
        address claimReceiver
    );

    event FinalityPeriodUpdated(uint256 targetChainId, uint256 finalityPeriod);

    /// Emitted when token object of a token address is updated.@author
    ///
    /// .. seealso:: :sol:func:`updateToken`
    event TokenUpdated(
        address tokenAddress,
        uint256 transferLimit,
        uint96 minLpFee,
        uint32 lpFeePPM,
        uint32 protocolFeePPM
    );

    /// Emitted when a request has been resolved via L1 resolution.
    ///
    /// .. seealso:: :sol:func:`resolveRequest`
    event RequestResolved(bytes32 requestId, address filler, bytes32 fillId);

    /// Emitted when an invalidated fill has been resolved.
    ///
    /// .. seealso:: :sol:func:`invalidateFill`
    event FillInvalidatedResolved(bytes32 requestId, bytes32 fillId);

    // Constants

    /// The minimum amount of source chain's native token that the claimer needs to
    /// provide when making a claim, as well in each round of the challenge game.
    uint256 public immutable claimStake;

    /// The additional time given to claim a request. This value is added to the
    /// validity period of a request.
    uint256 public immutable claimRequestExtension;

    /// The period for which the claim is valid.
    uint256 public immutable claimPeriod;

    /// The period by which the termination time of a claim is extended after each
    /// round of the challenge game. This period should allow enough time for the
    /// other parties to counter-challenge.
    ///
    /// .. note::
    ///
    ///    The claim's termination time is extended only if it is less than the
    ///    extension time.
    ///
    /// Note that in the first challenge round, i.e. the round initiated by the first
    /// challenger, the termination time is extended additionally by the finality
    /// period of the target chain. This is done to allow for L1 resolution.
    uint256 public immutable challengePeriodExtension;

    /// The minimum validity period of a request.
    uint256 public constant MIN_VALIDITY_PERIOD = 30 minutes;

    /// The maximum validity period of a request.
    uint256 public constant MAX_VALIDITY_PERIOD = 48 hours;

    /// withdrawClaimId is set to this value when an expired request gets withdrawn by the sender
    uint256 public constant CLAIM_ID_WITHDRAWN_EXPIRED = type(uint256).max;

    // Variables

    /// Indicates whether the contract is deprecated. A deprecated contract
    /// cannot be used to create new requests.
    bool public deprecated;

    /// A counter used to generate request and claim IDs.
    /// The variable holds the most recently used nonce and must
    /// be incremented to get the next nonce
    uint256 public currentNonce;

    /// Maps target rollup chain IDs to finality periods.
    /// Finality periods are in seconds.
    mapping(uint256 => uint256) public finalityPeriods;

    /// Maps request IDs to requests.
    mapping(bytes32 => Request) public requests;

    /// Maps claim IDs to claims.
    mapping(uint256 => Claim) public claims;

    /// Maps ERC20 token address to tokens
    mapping(address => Token) public tokens;

    /// The minimum fee, denominated in transfer token, paid to the liquidity provider.
    uint256 public minLpFee = 5 ether; // 5e18

    /// Liquidity provider fee percentage, expressed in ppm (parts per million).
    uint256 public lpFeePPM = 1_000; // 0.1% of the token amount being transferred

    /// Protocol fee percentage, expressed in ppm (parts per million).
    uint256 public protocolFeePPM = 0; // 0% of the token amount being transferred

    /// The maximum amount of tokens that can be transferred in a single request.
    uint256 public transferLimit = 10000 ether; // 10000e18

    /// Compute the liquidy provider fee that needs to be paid for a given transfer amount.
    function lpFee(uint256 amount) public view returns (uint256) {
        return Math.max(minLpFee, (amount * lpFeePPM) / 1_000_000);
    }

    /// Compute the protocol fee that needs to be paid for a given transfer amount.
    function protocolFee(uint256 amount) public view returns (uint256) {
        return (amount * protocolFeePPM) / 1_000_000;
    }

    /// Compute the total fee that needs to be paid for a given transfer amount.
    /// The total fee is the sum of the liquidity provider fee and the protocol fee.
    function totalFee(uint256 amount) public view returns (uint256) {
        return lpFee(amount) + protocolFee(amount);
    }

    // Modifiers

    /// Check whether a given request ID is valid.
    modifier validRequestId(bytes32 requestId) {
        require(
            requests[requestId].sender != address(0),
            "requestId not valid"
        );
        _;
    }

    /// Check whether a given claim ID is valid.
    modifier validClaimId(uint256 claimId) {
        require(claims[claimId].claimer != address(0), "claimId not valid");
        _;
    }

    /// Constructor.
    ///
    /// @param _claimStake Claim stake amount.
    /// @param _claimRequestExtension Extension to claim a request after validity period ends.
    /// @param _claimPeriod Claim period, in seconds.
    /// @param _challengePeriodExtension Challenge period extension, in seconds.
    constructor(
        uint256 _claimStake,
        uint256 _claimRequestExtension,
        uint256 _claimPeriod,
        uint256 _challengePeriodExtension
    ) {
        claimStake = _claimStake;
        claimRequestExtension = _claimRequestExtension;
        claimPeriod = _claimPeriod;
        challengePeriodExtension = _challengePeriodExtension;
    }

    /// Create a new transfer request.
    ///
    /// @param targetChainId ID of the target chain.
    /// @param sourceTokenAddress Address of the token contract on the source chain.
    /// @param targetTokenAddress Address of the token contract on the target chain.
    /// @param targetAddress Recipient address on the target chain.
    /// @param amount Amount of tokens to transfer. Does not include fees.
    /// @param validityPeriod The number of seconds the request is to be considered valid.
    ///                       Once its validity period has elapsed, the request cannot be claimed
    ///                       anymore and will eventually expire, allowing the request submitter
    ///                       to withdraw the deposited tokens if there are no active claims.
    /// @return ID of the newly created request.
    function createRequest(
        uint256 targetChainId,
        address sourceTokenAddress,
        address targetTokenAddress,
        address targetAddress,
        uint256 amount,
        uint256 validityPeriod
    ) external returns (bytes32) {
        require(deprecated == false, "Contract is deprecated");
        require(
            finalityPeriods[targetChainId] != 0,
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
        require(amount <= transferLimit, "Amount exceeds transfer limit");

        IERC20 token = IERC20(sourceTokenAddress);

        uint256 lpFeeTokenAmount = lpFee(amount);
        uint256 protocolFeeTokenAmount = protocolFee(amount);

        require(
            token.allowance(msg.sender, address(this)) >=
                amount + lpFeeTokenAmount + protocolFeeTokenAmount,
            "Insufficient allowance"
        );

        uint256 nonce = currentNonce + 1;
        currentNonce = nonce;

        bytes32 requestId = BeamerUtils.createRequestId(
            block.chainid,
            targetChainId,
            targetTokenAddress,
            targetAddress,
            amount,
            nonce
        );

        Request storage newRequest = requests[requestId];
        newRequest.sender = msg.sender;
        newRequest.sourceTokenAddress = sourceTokenAddress;
        newRequest.targetChainId = targetChainId;
        newRequest.amount = amount;
        newRequest.validUntil = uint32(block.timestamp + validityPeriod);
        newRequest.lpFee = uint96(lpFeeTokenAmount);
        newRequest.protocolFee = uint96(protocolFeeTokenAmount);

        emit RequestCreated(
            requestId,
            targetChainId,
            sourceTokenAddress,
            targetTokenAddress,
            targetAddress,
            amount,
            nonce,
            uint32(block.timestamp + validityPeriod)
        );

        token.safeTransferFrom(
            msg.sender,
            address(this),
            amount + lpFeeTokenAmount + protocolFeeTokenAmount
        );

        return requestId;
    }

    /// Withdraw funds deposited with an expired request.
    ///
    /// No claims must be active for the request.
    ///
    /// @param requestId ID of the expired request.
    function withdrawExpiredRequest(bytes32 requestId)
        external
        validRequestId(requestId)
    {
        Request storage request = requests[requestId];

        require(request.withdrawClaimId == 0, "Deposit already withdrawn");
        require(
            block.timestamp >= request.validUntil,
            "Request not expired yet"
        );
        require(request.activeClaims == 0, "Active claims running");

        request.withdrawClaimId = CLAIM_ID_WITHDRAWN_EXPIRED;

        emit DepositWithdrawn(requestId, request.sender);

        IERC20 token = IERC20(request.sourceTokenAddress);
        token.safeTransfer(
            request.sender,
            request.amount + request.lpFee + request.protocolFee
        );
    }

    /// Claim that a request was filled by the caller.
    ///
    /// The request must still be valid at call time.
    /// The caller must provide the ``claimStake`` amount of source rollup's native
    /// token.
    ///
    /// @param requestId ID of the request.
    /// @param fillId The fill ID.
    /// @return The claim ID.
    function claimRequest(bytes32 requestId, bytes32 fillId)
        external
        payable
        validRequestId(requestId)
        onlyWhitelist
        returns (uint256)
    {
        Request storage request = requests[requestId];

        require(
            block.timestamp < request.validUntil + claimRequestExtension,
            "Request cannot be claimed anymore"
        );
        require(request.withdrawClaimId == 0, "Deposit already withdrawn");
        require(msg.value == claimStake, "Invalid stake amount");
        require(fillId != bytes32(0), "FillId must not be 0x0");

        request.activeClaims += 1;

        uint256 nonce = currentNonce + 1;
        currentNonce = nonce;
        uint256 termination = block.timestamp + claimPeriod;

        Claim storage claim = claims[nonce];
        claim.requestId = requestId;
        claim.claimer = msg.sender;
        claim.claimerStake = msg.value;
        claim.termination = termination;
        claim.fillId = fillId;

        emit ClaimMade(
            requestId,
            nonce,
            msg.sender,
            msg.value,
            address(0),
            0,
            termination,
            fillId
        );

        return nonce;
    }

    /// Challenge an existing claim.
    ///
    /// The claim must still be valid at call time.
    /// This function implements one round of the challenge game.
    /// The original claimer is allowed to call this function only
    /// after someone else made a challenge, i.e. every second round.
    /// However, once the original claimer counter-challenges, anyone
    /// can join the game and make another challenge.
    ///
    /// The caller must provide enough native tokens as their stake.
    /// For the original claimer, the minimum stake is
    /// ``challengerStakeTotal - claimerStake + claimStake``.
    ///
    /// For challengers, the minimum stake is
    /// ``claimerStake - challengerStakeTotal + 1``.
    ///
    /// An example (time flows downwards, claimStake = 10)::
    ///
    ///   claimRequest() by Max [stakes 10]
    ///   challengeClaim() by Alice [stakes 11]
    ///   challengeClaim() by Max [stakes 11]
    ///   challengeClaim() by Bob [stakes 16]
    ///
    /// In this example, if Max didn't want to lose the challenge game to
    /// Alice and Bob, he would have to challenge with a stake of at least 16.
    ///
    /// @param claimId The claim ID.
    function challengeClaim(uint256 claimId)
        external
        payable
        validClaimId(claimId)
    {
        Claim storage claim = claims[claimId];
        bytes32 requestId = claim.requestId;
        uint256 termination = claim.termination;
        Request storage request = requests[requestId];
        require(block.timestamp < termination, "Claim expired");
        require(request.filler == address(0), "Request already resolved");
        require(
            !request.invalidFillIds[claim.fillId],
            "Fill already invalidated"
        );

        uint256 periodExtension = challengePeriodExtension;
        address claimer = claim.claimer;
        uint256 claimerStake = claim.claimerStake;
        uint256 challengerStakeTotal = claim.challengerStakeTotal;

        if (claimerStake > challengerStakeTotal) {
            if (challengerStakeTotal == 0) {
                periodExtension += finalityPeriods[request.targetChainId];
            }
            require(msg.sender != claimer, "Cannot challenge own claim");
            require(
                msg.value >= claimerStake - challengerStakeTotal + 1,
                "Not enough stake provided"
            );
        } else {
            require(msg.sender == claimer, "Not eligible to outbid");
            require(
                msg.value >= challengerStakeTotal - claimerStake + claimStake,
                "Not enough stake provided"
            );
        }

        if (msg.sender == claimer) {
            claimerStake += msg.value;
            claim.claimerStake = claimerStake;
        } else {
            claim.lastChallenger = msg.sender;
            claim.challengersStakes[msg.sender] += msg.value;
            challengerStakeTotal += msg.value;
            claim.challengerStakeTotal = challengerStakeTotal;
        }

        if (block.timestamp + periodExtension > termination) {
            termination = block.timestamp + periodExtension;
            claim.termination = termination;
        }

        emit ClaimMade(
            requestId,
            claimId,
            claimer,
            claimerStake,
            claim.lastChallenger,
            challengerStakeTotal,
            termination,
            claim.fillId
        );
    }

    /// Withdraw the deposit that the request submitter left with the contract,
    /// as well as the staked native tokens associated with the claim.
    ///
    /// In case the caller of this function is a challenger that won the game,
    /// they will only get their staked native tokens plus the reward in the form
    /// of full (sole challenger) or partial (multiple challengers) amount
    /// of native tokens staked by the dishonest claimer.
    ///
    /// @param claimId The claim ID.
    /// @return The address of the deposit receiver.
    function withdraw(uint256 claimId)
        external
        validClaimId(claimId)
        returns (address)
    {
        Claim storage claim = claims[claimId];
        bytes32 requestId = claim.requestId;
        Request storage request = requests[requestId];

        (address claimReceiver, uint256 ethToTransfer) = resolveClaim(claimId);

        if (claim.challengersStakes[claimReceiver] > 0) {
            //Re-entrancy protection
            claim.challengersStakes[claimReceiver] = 0;
        }

        uint256 withdrawnAmount = claim.withdrawnAmount;

        // First time withdraw is called, remove it from active claims
        if (withdrawnAmount == 0) {
            request.activeClaims -= 1;
        }
        withdrawnAmount += ethToTransfer;
        claim.withdrawnAmount = withdrawnAmount;

        require(
            withdrawnAmount <= claim.claimerStake + claim.challengerStakeTotal,
            "Amount to withdraw too large"
        );

        (bool sent, ) = claimReceiver.call{value: ethToTransfer}("");
        require(sent, "Failed to send Ether");

        emit ClaimStakeWithdrawn(claimId, requestId, claimReceiver);

        if (request.withdrawClaimId == 0 && claimReceiver == claim.claimer) {
            withdrawDeposit(request, claimId);
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
        uint256 withdrawClaimId = request.withdrawClaimId;
        address claimer = claim.claimer;
        uint256 claimerStake = claim.claimerStake;
        uint256 challengerStakeTotal = claim.challengerStakeTotal;
        bytes32 claimFillId = claim.fillId;
        require(
            claim.withdrawnAmount < claimerStake + challengerStakeTotal,
            "Claim already withdrawn"
        );

        bool claimValid = false;

        // The claim is resolved with the following priority:
        // 1) The l1 resolved filler is the claimer and l1 resolved fillId matches, claim is valid
        // 2) FillId is true in request's invalidFillIds, claim is invalid
        // 3) The withdrawer's claim matches exactly this claim (same claimer address, same fillId)
        // 4) Claim properties, claim terminated and claimer has the highest stake
        address filler = request.filler;
        bytes32 fillId = request.fillId;

        if (filler != address(0)) {
            // Claim resolution via 1)
            claimValid = filler == claimer && fillId == claimFillId;
        } else if (request.invalidFillIds[fillId]) {
            // Claim resolution via 2)
            claimValid = false;
        } else if (withdrawClaimId != 0) {
            // Claim resolution via 3)
            claimValid =
                claimer == claims[withdrawClaimId].claimer &&
                claimFillId == claims[withdrawClaimId].fillId;
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
            claimReceiver = claimer;
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

    function withdrawDeposit(Request storage request, uint256 claimId) private {
        Claim storage claim = claims[claimId];
        address claimer = claim.claimer;
        emit DepositWithdrawn(claim.requestId, claimer);

        request.withdrawClaimId = claimId;

        tokens[request.sourceTokenAddress].collectedProtocolFees += request
            .protocolFee;

        IERC20 token = IERC20(request.sourceTokenAddress);
        token.safeTransfer(claimer, request.amount + request.lpFee);
    }

    /// Returns whether a request's deposit was withdrawn or not
    ///
    /// This can be true in two cases:
    /// 1. The deposit was withdrawn after the request was claimed and filled.
    /// 2. The submitter withdrew the deposit after the request's expiry.
    /// .. seealso:: :sol:func:`withdraw`
    /// .. seealso:: :sol:func:`withdrawExpiredRequest`
    ///
    /// @param requestId The request ID
    /// @return Whether the deposit corresponding to the given request ID was withdrawn
    function isWithdrawn(bytes32 requestId)
        public
        view
        validRequestId(requestId)
        returns (bool)
    {
        return requests[requestId].withdrawClaimId != 0;
    }

    /// Withdraw protocol fees collected by the contract.
    ///
    /// Protocol fees are paid in token transferred.
    ///
    /// .. note:: This function can only be called by the contract owner.
    ///
    /// @param tokenAddress The address of the token contract.
    /// @param recipient The address the fees should be sent to.
    function withdrawProtocolFees(address tokenAddress, address recipient)
        external
        onlyOwner
    {
        uint256 amount = tokens[tokenAddress].collectedProtocolFees;
        require(amount > 0, "Protocol fee is zero");
        tokens[tokenAddress].collectedProtocolFees = 0;

        IERC20 token = IERC20(tokenAddress);
        token.safeTransfer(recipient, amount);
    }

    /// Update fee parameters.
    ///
    /// .. note:: This function can only be called by the contract owner.
    ///
    /// @param newProtocolFeePPM The new value for ``protocolFeePPM``.
    /// @param newLpFeePPM The new value for ``lpFeePPM``.
    /// @param newMinLpFee The new value for ``minLpFee``.
    function updateFeeData(
        uint256 newProtocolFeePPM,
        uint256 newLpFeePPM,
        uint256 newMinLpFee
    ) external onlyOwner {
        protocolFeePPM = newProtocolFeePPM;
        lpFeePPM = newLpFeePPM;
        minLpFee = newMinLpFee;
    }

    /// Update the transfer amount limit.
    ///
    /// .. note:: This function can only be called by the contract owner.
    ///
    /// @param newTransferLimit The new value for ``transferLimit``.
    function updateTransferLimit(uint256 newTransferLimit) external onlyOwner {
        transferLimit = newTransferLimit;
    }

    function updateToken(
        address tokenAddress,
        uint256 transferLimit,
        uint96 minLpFee,
        uint32 lpFeePPM,
        uint32 protocolFeePPM
    ) external onlyOwner {
        require(lpFeePPM <= 999999, "Maximum PPM of 999999 exceeded");
        require(protocolFeePPM <= 999999, "Maximum PPM of 999999 exceeded");

        Token storage token = tokens[tokenAddress];
        token.transferLimit = transferLimit;
        token.minLpFee = minLpFee;
        token.lpFeePPM = lpFeePPM;
        token.protocolFeePPM = protocolFeePPM;

        emit TokenUpdated(
            tokenAddress,
            transferLimit,
            minLpFee,
            lpFeePPM,
            protocolFeePPM
        );
    }

    /// Set the finality period for the given target chain.
    ///
    /// .. note:: This function can only be called by the contract owner.
    ///
    /// @param targetChainId The target chain ID.
    /// @param finalityPeriod Finality period in seconds.
    function setFinalityPeriod(uint256 targetChainId, uint256 finalityPeriod)
        external
        onlyOwner
    {
        require(finalityPeriod > 0, "Finality period must be greater than 0");
        finalityPeriods[targetChainId] = finalityPeriod;

        emit FinalityPeriodUpdated(targetChainId, finalityPeriod);
    }

    /// Mark the contract as deprecated.
    ///
    /// Once the contract is deprecated, it cannot be used to create new
    /// requests anymore. Withdrawing deposited funds and claim stakes
    /// still works, though.
    ///
    /// .. note:: This function can only be called by the contract owner.
    function deprecateContract() external onlyOwner {
        require(deprecated == false, "Contract already deprecated");
        deprecated = true;
    }

    /// Returns whether a fill is invalidated or not
    ///
    /// Calling invalidateFill() will set this boolean to true,
    /// marking that the ``fillId`` for the corresponding ``requestId`` was
    /// invalidated.
    /// Calling resolveRequest will validate it again, setting request.invalidatedFills[fillId]
    /// to false.
    /// .. seealso:: :sol:func:`invalidateFill`
    /// .. seealso:: :sol:func:`resolveRequest`
    ///
    /// @param requestId The request ID
    /// @param fillId The fill ID
    /// @return Whether the fill ID is invalid for the given request ID
    function isInvalidFill(bytes32 requestId, bytes32 fillId)
        public
        view
        returns (bool)
    {
        return requests[requestId].invalidFillIds[fillId];
    }

    /// Mark the request identified by ``requestId`` as filled by ``filler``.
    ///
    /// .. note::
    ///
    ///     This function is a restricted call function. Only callable by the added caller.
    ///
    /// @param requestId The request ID.
    /// @param fillId The fill ID.
    /// @param resolutionChainId The resolution (L1) chain ID.
    /// @param filler The address that filled the request.
    function resolveRequest(
        bytes32 requestId,
        bytes32 fillId,
        uint256 resolutionChainId,
        address filler
    ) external restricted(resolutionChainId) {
        Request storage request = requests[requestId];
        request.filler = filler;
        request.fillId = fillId;

        request.invalidFillIds[fillId] = false;

        emit RequestResolved(requestId, filler, fillId);
    }

    /// Mark the fill identified by ``requestId`` and ``fillId`` as invalid.
    ///
    /// .. note::
    ///
    ///     This function is a restricted call function. Only callable by the added caller.
    ///
    /// @param requestId The request ID.
    /// @param fillId The fill ID.
    /// @param resolutionChainId The resolution (L1) chain ID.
    function invalidateFill(
        bytes32 requestId,
        bytes32 fillId,
        uint256 resolutionChainId
    ) external restricted(resolutionChainId) {
        Request storage request = requests[requestId];
        require(
            request.filler == address(0),
            "Cannot invalidate resolved fills"
        );
        require(
            request.invalidFillIds[fillId] == false,
            "Fill already invalidated"
        );

        request.invalidFillIds[fillId] = true;

        emit FillInvalidatedResolved(requestId, fillId);
    }
}
