import { newMockEvent } from "matchstick-as"
import { ethereum, Bytes, Address, BigInt } from "@graphprotocol/graph-ts"
import {
  HashInvalidated,
  LPAdded,
  LPRemoved,
  FillManagerOwnershipTransferred,
  RequestFilled
} from "../generated/FillManager/FillManager"

export function createHashInvalidatedEvent(
  requestHash: Bytes,
  fillId: Bytes,
  fillHash: Bytes
): HashInvalidated {
  let hashInvalidatedEvent = changetype<HashInvalidated>(newMockEvent())

  hashInvalidatedEvent.parameters = new Array()

  hashInvalidatedEvent.parameters.push(
    new ethereum.EventParam(
      "requestHash",
      ethereum.Value.fromFixedBytes(requestHash)
    )
  )
  hashInvalidatedEvent.parameters.push(
    new ethereum.EventParam("fillId", ethereum.Value.fromFixedBytes(fillId))
  )
  hashInvalidatedEvent.parameters.push(
    new ethereum.EventParam("fillHash", ethereum.Value.fromFixedBytes(fillHash))
  )

  return hashInvalidatedEvent
}

export function createLPAddedEvent(lp: Address): LPAdded {
  let lpAddedEvent = changetype<LPAdded>(newMockEvent())

  lpAddedEvent.parameters = new Array()

  lpAddedEvent.parameters.push(
    new ethereum.EventParam("lp", ethereum.Value.fromAddress(lp))
  )

  return lpAddedEvent
}

export function createLPRemovedEvent(lp: Address): LPRemoved {
  let lpRemovedEvent = changetype<LPRemoved>(newMockEvent())

  lpRemovedEvent.parameters = new Array()

  lpRemovedEvent.parameters.push(
    new ethereum.EventParam("lp", ethereum.Value.fromAddress(lp))
  )

  return lpRemovedEvent
}

export function createFillManagerOwnershipTransferredEvent(
  previousOwner: Address,
  newOwner: Address
): FillManagerOwnershipTransferred {
  let fillManagerOwnershipTransferredEvent = changetype<
    FillManagerOwnershipTransferred
  >(newMockEvent())

  fillManagerOwnershipTransferredEvent.parameters = new Array()

  fillManagerOwnershipTransferredEvent.parameters.push(
    new ethereum.EventParam(
      "previousOwner",
      ethereum.Value.fromAddress(previousOwner)
    )
  )
  fillManagerOwnershipTransferredEvent.parameters.push(
    new ethereum.EventParam("newOwner", ethereum.Value.fromAddress(newOwner))
  )

  return fillManagerOwnershipTransferredEvent
}

export function createRequestFilledEvent(
  requestId: BigInt,
  fillId: Bytes,
  sourceChainId: BigInt,
  targetTokenAddress: Address,
  filler: Address,
  amount: BigInt
): RequestFilled {
  let requestFilledEvent = changetype<RequestFilled>(newMockEvent())

  requestFilledEvent.parameters = new Array()

  requestFilledEvent.parameters.push(
    new ethereum.EventParam(
      "requestId",
      ethereum.Value.fromUnsignedBigInt(requestId)
    )
  )
  requestFilledEvent.parameters.push(
    new ethereum.EventParam("fillId", ethereum.Value.fromFixedBytes(fillId))
  )
  requestFilledEvent.parameters.push(
    new ethereum.EventParam(
      "sourceChainId",
      ethereum.Value.fromUnsignedBigInt(sourceChainId)
    )
  )
  requestFilledEvent.parameters.push(
    new ethereum.EventParam(
      "targetTokenAddress",
      ethereum.Value.fromAddress(targetTokenAddress)
    )
  )
  requestFilledEvent.parameters.push(
    new ethereum.EventParam("filler", ethereum.Value.fromAddress(filler))
  )
  requestFilledEvent.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount))
  )

  return requestFilledEvent
}
