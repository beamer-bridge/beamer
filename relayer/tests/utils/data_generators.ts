import path from "path";

import type { TransactionHash } from "@/services/types";

const HEXADECIMAL_CHARACTERS = "0123456789abcdefABCDEF";
const ALPHABET_CHARACTERS = "abcdefghijklmnopqrstuvwxyz";

export function getRandomString(charSet = ALPHABET_CHARACTERS, length = 5, prefix = ""): string {
  let output = prefix;

  for (let i = 0; i < length; i++) {
    output += charSet.charAt(Math.floor(Math.random() * charSet.length));
  }

  return output;
}

export function getRandomTransactionHash(): TransactionHash {
  return getRandomString(HEXADECIMAL_CHARACTERS, 64, "0x");
}

export function getKeystoreFilePath(): TransactionHash {
  return path.join(__dirname, "test_account.json");
}

export function getAccountPassword(): TransactionHash {
  return "test";
}

export function getRandomUrl(subDomain: string): string {
  return getRandomString(ALPHABET_CHARACTERS, 8, `https://${subDomain}.`);
}

export function getRandomNumber(minimum = 1, maximum = 100): number {
  return Math.floor(Math.random() * maximum + minimum);
}

export function getRandomEthereumAddress(): string {
  return getRandomString(HEXADECIMAL_CHARACTERS, 32, "0x");
}

export function generateLog() {
  return {
    blockNumber: getRandomNumber(),
    blockHash: getRandomTransactionHash(),
    transactionIndex: getRandomNumber(),
    removed: false,
    address: getRandomEthereumAddress(),
    data: getRandomString(),
    topics: [],
    transactionHash: getRandomTransactionHash(),
    logIndex: getRandomNumber(),
  };
}
