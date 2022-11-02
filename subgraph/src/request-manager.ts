import {
  ClaimMade as ClaimMadeEvent,
  ClaimStakeWithdrawn as ClaimStakeWithdrawnEvent,
  DepositWithdrawn as DepositWithdrawnEvent,
  FinalityPeriodUpdated as FinalityPeriodUpdatedEvent,
  OwnershipTransferred as OwnershipTransferredEvent,
  RequestCreated as RequestCreatedEvent,
} from '../generated/RequestManager/RequestManager';
import {
  ClaimMade,
  DepositWithdrawn,
  ClaimStakeWithdrawn,
  FinalityPeriodUpdated,
  OwnershipTransferred,
  RequestCreated,
} from '../generated/schema';

export function handleClaimMade(event: ClaimMadeEvent): void {
  const entity = new ClaimMade(event.transaction.hash.toHex() + '-' + event.logIndex.toString());
  entity.requestId = event.params.requestId;
  entity.claimId = event.params.claimId;
  entity.claimer = event.params.claimer;
  entity.claimerStake = event.params.claimerStake;
  entity.lastChallenger = event.params.lastChallenger;
  entity.challengerStakeTotal = event.params.challengerStakeTotal;
  entity.termination = event.params.termination;
  entity.fillId = event.params.fillId;

  entity.save();
}

export function handleClaimStakeWithdrawn(event: ClaimStakeWithdrawnEvent): void {
  const entity = new ClaimStakeWithdrawn(
    event.transaction.hash.toHex() + '-' + event.logIndex.toString(),
  );
  entity.claimId = event.params.claimId;
  entity.requestId = event.params.requestId;
  entity.claimReceiver = event.params.claimReceiver;

  entity.save();
}

export function handleDepositWithdrawn(event: DepositWithdrawnEvent): void {
  const entity = new DepositWithdrawn(
    event.transaction.hash.toHex() + '-' + event.logIndex.toString(),
  );

  entity.requestId = event.params.requestId;
  entity.receiver = event.params.receiver;

  entity.save();
}

export function handleFinalityPeriodUpdated(event: FinalityPeriodUpdatedEvent): void {
  const entity = new FinalityPeriodUpdated(
    event.transaction.hash.toHex() + '-' + event.logIndex.toString(),
  );

  entity.targetChainId = event.params.targetChainId;
  entity.finalityPeriod = event.params.finalityPeriod;

  entity.save();
}

export function handleOwnershipTransferred(event: OwnershipTransferredEvent): void {
  const entity = new OwnershipTransferred(
    event.transaction.hash.toHex() + '-' + event.logIndex.toString(),
  );

  entity.previousOwner = event.params.previousOwner;
  entity.newOwner = event.params.newOwner;

  entity.save();
}

export function handleRequestCreated(event: RequestCreatedEvent): void {
  const entity = new RequestCreated(
    event.transaction.hash.toHex() + '-' + event.logIndex.toString(),
  );

  entity.requestId = event.params.requestId;
  entity.targetChainId = event.params.targetChainId;
  entity.sourceTokenAddress = event.params.sourceTokenAddress;
  entity.targetTokenAddress = event.params.targetTokenAddress;
  entity.targetAddress = event.params.targetAddress;
  entity.amount = event.params.amount;
  entity.validUntil = event.params.validUntil;

  entity.save();
}
