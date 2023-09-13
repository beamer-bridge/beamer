import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  ClaimMade, ClaimStakeWithdrawn,
  DepositWithdrawn,
  FillInvalidatedResolved,
  OwnershipTransferred,
  RequestCreated,
  RequestResolved
} from "../../generated/RequestManager/RequestManager";
import {Claim, FillState, Request} from '../../generated/schema';
import {ADDRESS_ZERO_BYTES, ZERO_BI, ZERO_BYTES, CLAIM_ID_EXPIRED_REQUEST} from '../utils/constants';
import { loadTransaction } from "../utils";

export function handleClaimMade(event: ClaimMade): void {
  const claim = new Claim(event.params.claimId.toString());

  claim.claimer = event.params.claimer;
  claim.claimerStake = event.params.claimerStake;
  claim.lastChallenger = event.params.lastChallenger;
  claim.challengerStakeTotal = event.params.challengerStakeTotal;
  claim.termination = event.params.termination;
  claim.fillId = event.params.fillId;
  claim.transaction = loadTransaction(event).id
  claim.emittedAt = event.block.timestamp
  claim.emittedByTx = event.transaction.hash
  claim.contractAddress = event.address
  claim.resolved = false;

  const request = Request.load(event.params.requestId);

  if (request) {
    claim.request = request.id;
    claim.save();

    const claims = request.claims;
    request.claims = claims && claims.length > 0 ? claims.concat([claim.id]) : [claim.id];
    if(claim.lastChallenger == ADDRESS_ZERO_BYTES) {
      request.activeClaims = request.activeClaims.plus(BigInt.fromI32(1));
    }
    request.save();
  } else {
    // save the claim, event if we for some reason can't find a request for it
    claim.save();
  }
}

export function handleClaimStakeWithdrawn(event: ClaimStakeWithdrawn): void {
  const claimId = event.params.claimId;
  const requestId = event.params.requestId;
  const stakeRecipient = event.params.stakeRecipient;

  const claim = Claim.load(claimId.toString());
  const request = Request.load(requestId);

  if(claim && request && claim.resolved == false) {
    claim.resolved = true;
    request.activeClaims = request.activeClaims.minus(BigInt.fromI32(1));
    claim.save();
    request.save();
  }
}
export function handleDepositWithdrawn(event: DepositWithdrawn): void {
  const requestId = event.params.requestId;
  const receiver = event.params.receiver;
  const request = Request.load(requestId);

  if (request) {
   // If the receiver is the request sender, then the user is withdrawing
    // because the request has expired with no fill
    if(request.sender.toHexString() == receiver.toHexString()) {
      request.withdrawClaimId = (CLAIM_ID_EXPIRED_REQUEST);
    } else {
      const claims = request.claims;
      // iterate over claims and find the one with claimer event.params.receiver
      // if found, set the withdrawClaimId to that claim.id
      for (let i = 0; i < claims.length; i++) {
        const claim = Claim.load(claims[i]);
        if (claim && claim.claimer == event.params.receiver) {
          request.withdrawClaimId = BigInt.fromString(claim.id);
          break;
        }
      }
    }

    request.save();
  }
}

export function handleRequestCreated(event: RequestCreated): void {
  let request = new Request(event.params.requestId);
  request.sender = event.params.sourceAddress;
  request.sourceTokenAddress = event.params.sourceTokenAddress;
  request.targetTokenAddress = event.params.targetTokenAddress;
  request.targetChainId = event.params.targetChainId;
  request.amount = event.params.amount;
  request.validUntil = event.params.validUntil;
  request.lpFee = event.params.lpFee;
  request.protocolFee = event.params.protocolFee;
  request.activeClaims = ZERO_BI;
  request.withdrawClaimId = ZERO_BI;
  request.filler = ADDRESS_ZERO_BYTES;
  request.fillId = ZERO_BYTES;
  request.targetAddress = event.params.targetAddress;
  request.nonce = event.params.nonce;
  request.invalidFills = [];
  request.claims = [];
  request.transaction = loadTransaction(event).id
  request.emittedAt = event.block.timestamp
  request.emittedByTx = event.transaction.hash
  request.contractAddress = event.address

  request.save();
}

export function handleFillInvalidatedResolved(event: FillInvalidatedResolved): void {
  const request = Request.load(event.params.requestId);

  if (request) {
    const invalidFills = request.invalidFills || [];

    for (let i = 0; i < invalidFills.length; i++) {
      const fillState = FillState.load(invalidFills[i]);
      if (fillState && fillState.id == event.params.fillId) {
        fillState.invalid = true;
        fillState.save();
        break;
      }
    }
  }
}

export function handleRequestResolved(event: RequestResolved): void {
  const request = Request.load(event.params.requestId);

  if (request) {
    const invalidFills = request.invalidFills ?? [];

    for (let i = 0; i < invalidFills.length; i++) {
      const fillState = FillState.load(invalidFills[i]);
      if (fillState && fillState.id == event.params.fillId) {
        fillState.invalid = false;
        fillState.save();
      }
    }

    request.filler = event.params.filler;
    request.fillId = event.params.fillId;
    request.save();
  }
}
