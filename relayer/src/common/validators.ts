import type { TransactionHash } from "../services/types";

export function isTransactionHash(hash: TransactionHash): boolean {
  if (!hash.startsWith("0x") || hash.trim().length != 66) {
    return false;
  }

  return true;
}
