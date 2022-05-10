import type { StepData } from '@/actions/steps';
import type {
  RequestFillTransactionMetadata,
  RequestTransactionMetadata,
  TransferData,
} from '@/actions/transfer';
import type { ChainWithTokens } from '@/types/config';
import type { Chain, RequestMetadata, Token } from '@/types/data';

const HEXADECIMAL_CHARACTERS = '0123456789abcdefABCDEF';
const DECIMAL_CHARACTERS = '0123456789';
const ALPHABET_CHARACTERS = 'abcdefghijklmnopqrstuvwxyz';

export function getRandomString(charSet = ALPHABET_CHARACTERS, length = 5, prefix = ''): string {
  let output = prefix;

  for (let i = 0; i < length; i++) {
    output += charSet.charAt(Math.floor(Math.random() * charSet.length));
  }

  return output;
}

export function getRandomEthereumAddress(): string {
  return getRandomString(HEXADECIMAL_CHARACTERS, 32, '0x');
}

export function getRandomUrl(subDomain: string): string {
  return getRandomString(ALPHABET_CHARACTERS, 8, `https://${subDomain}.`);
}

export function getRandomTokenSymbol(): string {
  return getRandomString(ALPHABET_CHARACTERS, 3).toUpperCase();
}

export function getRandomChainName(): string {
  const name = getRandomString(ALPHABET_CHARACTERS, 5);
  const nameCapitalized = name.charAt(0).toUpperCase() + name.slice(1);
  return `${nameCapitalized} Chain`;
}

export function getRandomDecimalPointNumber(): string {
  const beforeDot = getRandomString(DECIMAL_CHARACTERS, 1);
  const afterDot = getRandomString(DECIMAL_CHARACTERS, 1);
  return `${beforeDot}.${afterDot}`;
}

export function getRandomNumber(minimum = 1, maximum = 100): number {
  return Math.floor(Math.random() * maximum + minimum);
}

export function generateStepData(partialStepData?: Partial<StepData>): StepData {
  return {
    identifier: getRandomString(ALPHABET_CHARACTERS, 10),
    label: getRandomString(ALPHABET_CHARACTERS, 15, 'label '),
    ...partialStepData,
  };
}

export function generateToken(partialToken?: Partial<Token>): Token {
  return {
    address: getRandomEthereumAddress(),
    symbol: getRandomTokenSymbol(),
    ...partialToken,
  } as Token;
}

export function generateChain(partialChain?: Partial<Chain>): Chain {
  return {
    identifier: getRandomNumber(), // TODO
    name: getRandomChainName(),
    rpcUrl: getRandomUrl('rpc'),
    requestManagerAddress: getRandomEthereumAddress(),
    fillManagerAddress: getRandomEthereumAddress(),
    explorerTransactionUrl: getRandomUrl('explorer'),
    ...partialChain,
  };
}

export function generateChainWithTokens(
  partialChainWithTokens?: Partial<ChainWithTokens>,
): ChainWithTokens {
  return {
    ...generateChain(),
    tokens: [generateToken()],
    ...partialChainWithTokens,
  };
}

export function generateRequestTransactionMetadata(
  partialRequestTransactionMetadata?: Partial<RequestTransactionMetadata>,
): RequestTransactionMetadata {
  return {
    requestAccount: getRandomEthereumAddress(),
    transactionHash: getRandomString(HEXADECIMAL_CHARACTERS, 40),
    ...partialRequestTransactionMetadata,
  };
}

export function generateRequestFillTransactionMetadata(
  partialRequestFillTransactionMetadata?: Partial<RequestFillTransactionMetadata>,
): RequestFillTransactionMetadata {
  return {
    fillerAccount: getRandomEthereumAddress(),
    transactionHash: getRandomString(HEXADECIMAL_CHARACTERS, 40),
    ...partialRequestFillTransactionMetadata,
  };
}

export function generateTransferData(partialTransferData?: Partial<TransferData>): TransferData {
  return {
    amount: getRandomNumber(),
    sourceChain: generateChain(),
    sourceToken: generateToken(),
    targetChain: generateChain(),
    targetToken: generateToken(),
    targetAccount: getRandomEthereumAddress(),
    validityPeriod: getRandomNumber(),
    fees: getRandomNumber(),
    ...partialTransferData,
  };
}

export function generateRequestMetadata(
  partialRequestMetadata?: Partial<RequestMetadata>,
): RequestMetadata {
  return {
    amount: getRandomDecimalPointNumber(),
    sourceChainName: getRandomChainName(),
    targetChainName: getRandomChainName(),
    targetAddress: getRandomEthereumAddress(),
    tokenSymbol: getRandomTokenSymbol(),
    fee: getRandomDecimalPointNumber(),
    ...partialRequestMetadata,
  };
}
