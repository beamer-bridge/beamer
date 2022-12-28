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

export function getRandomPrivateKey(): TransactionHash {
  return getRandomString(HEXADECIMAL_CHARACTERS, 64);
}

export function getRandomUrl(subDomain: string): string {
  return getRandomString(ALPHABET_CHARACTERS, 8, `https://${subDomain}.`);
}
