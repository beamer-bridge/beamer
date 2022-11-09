import { newMockEvent } from "matchstick-as"
import { ethereum, BigInt, Address, Bytes } from "@graphprotocol/graph-ts"
import {
  ClaimMade,
  ClaimStakeWithdrawn,
  DepositWithdrawn,
  FinalityPeriodUpdated,
  OwnershipTransferred,
  RequestCreated
} from "../generated/RequestManager/RequestManager"

export function createClaimMadeEvent(
  requestId: BigInt,
  claimId: BigInt,
  claimer: Address,
  claimerStake: BigInt,
  lastChallenger: Address,
  challengerStakeTotal: BigInt,
  termination: BigInt,
  fillId: Bytes
): ClaimMade {
  let claimMadeEvent = changetype<ClaimMade>(newMockEvent())

  claimMadeEvent.parameters = new Array()

  claimMadeEvent.parameters.push(
    new ethereum.EventParam(
      "requestId",
      ethereum.Value.fromUnsignedBigInt(requestId)
    )
  )
  claimMadeEvent.parameters.push(
    new ethereum.EventParam(
      "claimId",
      ethereum.Value.fromUnsignedBigInt(claimId)
    )
  )
  claimMadeEvent.parameters.push(
    new ethereum.EventParam("claimer", ethereum.Value.fromAddress(claimer))
  )
  claimMadeEvent.parameters.push(
    new ethereum.EventParam(
      "claimerStake",
      ethereum.Value.fromUnsignedBigInt(claimerStake)
    )
  )
  claimMadeEvent.parameters.push(
    new ethereum.EventParam(
      "lastChallenger",
      ethereum.Value.fromAddress(lastChallenger)
    )
  )
  claimMadeEvent.parameters.push(
    new ethereum.EventParam(
      "challengerStakeTotal",
      ethereum.Value.fromUnsignedBigInt(challengerStakeTotal)
    )
  )
  claimMadeEvent.parameters.push(
    new ethereum.EventParam(
      "termination",
      ethereum.Value.fromUnsignedBigInt(termination)
    )
  )
  claimMadeEvent.parameters.push(
    new ethereum.EventParam("fillId", ethereum.Value.fromFixedBytes(fillId))
  )

  return claimMadeEvent
}

export function createClaimStakeWithdrawnEvent(
  claimId: BigInt,
  requestId: BigInt,
  claimReceiver: Address
): ClaimStakeWithdrawn {
  let claimStakeWithdrawnEvent = changetype<ClaimStakeWithdrawn>(newMockEvent())

  claimStakeWithdrawnEvent.parameters = new Array()

  claimStakeWithdrawnEvent.parameters.push(
    new ethereum.EventParam(
      "claimId",
      ethereum.Value.fromUnsignedBigInt(claimId)
    )
  )
  claimStakeWithdrawnEvent.parameters.push(
    new ethereum.EventParam(
      "requestId",
      ethereum.Value.fromUnsignedBigInt(requestId)
    )
  )
  claimStakeWithdrawnEvent.parameters.push(
    new ethereum.EventParam(
      "claimReceiver",
      ethereum.Value.fromAddress(claimReceiver)
    )
  )

  return claimStakeWithdrawnEvent
}

export function createDepositWithdrawnEvent(
  requestId: BigInt,
  receiver: Address
): DepositWithdrawn {
  let depositWithdrawnEvent = changetype<DepositWithdrawn>(newMockEvent())

  depositWithdrawnEvent.parameters = new Array()

  depositWithdrawnEvent.parameters.push(
    new ethereum.EventParam(
      "requestId",
      ethereum.Value.fromUnsignedBigInt(requestId)
    )
  )
  depositWithdrawnEvent.parameters.push(
    new ethereum.EventParam("receiver", ethereum.Value.fromAddress(receiver))
  )

  return depositWithdrawnEvent
}

export function createFinalityPeriodUpdatedEvent(
  targetChainId: BigInt,
  finalityPeriod: BigInt
): FinalityPeriodUpdated {
  let finalityPeriodUpdatedEvent = changetype<FinalityPeriodUpdated>(
    newMockEvent()
  )

  finalityPeriodUpdatedEvent.parameters = new Array()

  finalityPeriodUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "targetChainId",
      ethereum.Value.fromUnsignedBigInt(targetChainId)
    )
  )
  finalityPeriodUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "finalityPeriod",
      ethereum.Value.fromUnsignedBigInt(finalityPeriod)
    )
  )

  return finalityPeriodUpdatedEvent
}

export function createOwnershipTransferredEvent(
  previousOwner: Address,
  newOwner: Address
): OwnershipTransferred {
  let ownershipTransferredEvent = changetype<OwnershipTransferred>(
    newMockEvent()
  )

  ownershipTransferredEvent.parameters = new Array()

  ownershipTransferredEvent.parameters.push(
    new ethereum.EventParam(
      "previousOwner",
      ethereum.Value.fromAddress(previousOwner)
    )
  )
  ownershipTransferredEvent.parameters.push(
    new ethereum.EventParam("newOwner", ethereum.Value.fromAddress(newOwner))
  )

  return ownershipTransferredEvent
}

export function createRequestCreatedEvent(
  requestId: BigInt,
  targetChainId: BigInt,
  sourceTokenAddress: Address,
  targetTokenAddress: Address,
  targetAddress: Address,
  amount: BigInt,
  validUntil: BigInt
): RequestCreated {
  let requestCreatedEvent = changetype<RequestCreated>(newMockEvent())

  requestCreatedEvent.parameters = new Array()

  requestCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "requestId",
      ethereum.Value.fromUnsignedBigInt(requestId)
    )
  )
  requestCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "targetChainId",
      ethereum.Value.fromUnsignedBigInt(targetChainId)
    )
  )
  requestCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "sourceTokenAddress",
      ethereum.Value.fromAddress(sourceTokenAddress)
    )
  )
  requestCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "targetTokenAddress",
      ethereum.Value.fromAddress(targetTokenAddress)
    )
  )
  requestCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "targetAddress",
      ethereum.Value.fromAddress(targetAddress)
    )
  )
  requestCreatedEvent.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount))
  )
  requestCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "validUntil",
      ethereum.Value.fromUnsignedBigInt(validUntil)
    )
  )

  return requestCreatedEvent
}
