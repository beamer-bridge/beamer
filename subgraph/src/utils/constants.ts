/* eslint-disable prefer-const */
import { BigInt, Address, Bytes } from '@graphprotocol/graph-ts'
export const ADDRESS_ZERO_STRING = '0x0000000000000000000000000000000000000000'
export const ADDRESS_ZERO_BYTES = Address.fromString(ADDRESS_ZERO_STRING)
export const ZERO_BI = BigInt.fromI32(0)
export const ZERO_BYTES = Bytes.fromI32(0)

// solidity's type(uint96).max
export const CLAIM_ID_EXPIRED_REQUEST = BigInt.fromString("79228162514264337593543950335")
export const TRANSFER_SIGNATURE = Bytes.fromHexString(
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' // This is identifier of the Transfer
)
