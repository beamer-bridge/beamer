import {
  RequestFilled as RequestFilledEvent
} from "../../generated/FillManager/FillManager"
import { Fill } from "../../generated/schema";
import { Address, Bytes } from "@graphprotocol/graph-ts";
import { TRANSFER_SIGNATURE } from "../utils/constants";

import { loadTransaction } from "../utils";
export function handleRequestFilled(event: RequestFilledEvent): void {
  let fill = new Fill(
    event.transaction.hash.concat(Bytes.fromUTF8('-' + event.logIndex.toString()))
  )

  fill.requestId = event.params.requestId
  fill.sourceChainId = event.params.sourceChainId
  fill.targetTokenAddress = event.params.targetTokenAddress
  fill.filler = event.params.filler
  fill.amount = event.params.amount
  fill.transaction = loadTransaction(event).id
  fill.emittedAt = event.block.timestamp
  fill.emittedByTx = event.transaction.hash
  fill.contractAddress = event.address
  const receipt = event.receipt

  if (receipt) {
    for (let index = 0; index < receipt.logs.length; index++) {
      const _topic0 = receipt.logs[index].topics[0]
      const _address = receipt.logs[index].address
      if (
        _topic0.equals(TRANSFER_SIGNATURE) &&
        _address.toHexString() == event.params.targetTokenAddress.toHexString()
      ) {
        const receiverWithPadding = receipt.logs[index].topics[2];

        // Convert bytes32 to string and remove the leading zeros (24 characters
        // which equates to 12 bytes of zeros + 2 characters for 0x prefix)
        const receiverStripped = receiverWithPadding.toHexString().slice(26);

        fill.receiver = Address.fromString(receiverStripped)
      }
    }
  }

  fill.save()
}

