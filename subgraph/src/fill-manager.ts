import {
  HashInvalidated as HashInvalidatedEvent,
  LPAdded as LPAddedEvent,
  LPRemoved as LPRemovedEvent,
  FillManagerOwnershipTransferred as FillManagerOwnershipTransferredEvent,
  RequestFilled as RequestFilledEvent
} from "../generated/FillManager/FillManager"
import {
  HashInvalidated,
  LPAdded,
  LPRemoved,
  FillManagerOwnershipTransferred,
  RequestFilled
} from "../generated/schema"

export function handleHashInvalidated(event: HashInvalidatedEvent): void {
  let entity = new HashInvalidated(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  )
  entity.requestHash = event.params.requestHash
  entity.fillId = event.params.fillId
  entity.fillHash = event.params.fillHash
  entity.save()
}

export function handleLPAdded(event: LPAddedEvent): void {
  let entity = new LPAdded(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  )
  entity.lp = event.params.lp
  entity.save()
}

export function handleLPRemoved(event: LPRemovedEvent): void {
  let entity = new LPRemoved(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  )
  entity.lp = event.params.lp
  entity.save()
}

export function handleFillManagerOwnershipTransferred(
  event: FillManagerOwnershipTransferredEvent
): void {
  let entity = new FillManagerOwnershipTransferred(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  )
  entity.previousOwner = event.params.previousOwner
  entity.newOwner = event.params.newOwner
  entity.save()
}

export function handleRequestFilled(event: RequestFilledEvent): void {
  let entity = new RequestFilled(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  )
  entity.requestId = event.params.requestId
  entity.fillId = event.params.fillId
  entity.sourceChainId = event.params.sourceChainId
  entity.targetTokenAddress = event.params.targetTokenAddress
  entity.filler = event.params.filler
  entity.amount = event.params.amount
  entity.save()
}
