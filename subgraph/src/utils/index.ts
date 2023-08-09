import { BigInt, BigDecimal, ethereum } from '@graphprotocol/graph-ts'
import { Transaction, Block } from "../../generated/schema";
import { ZERO_BI } from "./constants";

export function loadTransaction(event: ethereum.Event): Transaction {
  let transaction = Transaction.load(event.transaction.hash)
  if (transaction === null) {
    transaction = new Transaction(event.transaction.hash)
  }
  transaction.from = event.transaction.from
  transaction.to = event.transaction.to
  transaction.value = event.transaction.value
  transaction.gasLimit = event.transaction.gasLimit
  transaction.gasPrice = event.transaction.gasPrice
  transaction.input = event.transaction.input
  transaction.nonce = event.transaction.nonce
  transaction.block = loadBlock(event).id
  transaction.save()
  return transaction as Transaction
}

export function loadBlock(event: ethereum.Event): Block {
  let block = Block.load(event.block.hash)
  if (block === null) {
    block = new Block(event.block.hash)
  }
  block.number = event.block.number
  block.gasUsed = event.block.gasUsed
  block.gasLimit = event.block.gasLimit
  block.timestamp = event.block.timestamp
  block.save()
  return block as Block
}
