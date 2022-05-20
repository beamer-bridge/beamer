import type { StepData } from '@/actions/steps';
import type {
  FulfillmentInformation,
  RequestInformationData,
  TransferData,
} from '@/actions/transfers';
import type { ChainWithTokens } from '@/types/config';
import type { Chain, EthereumAddress, Token, TransactionHash } from '@/types/data';
import type { TokenAmountData } from '@/types/token-amount';
import type { UInt256Data } from '@/types/uint-256';

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

export function getRandomEthereumAddress(): EthereumAddress {
  return getRandomString(HEXADECIMAL_CHARACTERS, 32, '0x');
}

export function getRandomTransactionHash(): TransactionHash {
  return getRandomString(HEXADECIMAL_CHARACTERS, 66, '0x');
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

export function generateUInt256Data(value?: string): UInt256Data {
  return value ?? getRandomNumber(100000000000, 100000000000000).toString();
}

export function generateTokenAmountData(
  partialTokenAmount?: Partial<TokenAmountData>,
): TokenAmountData {
  return {
    token: generateToken(),
    amount: generateUInt256Data(),
    ...partialTokenAmount,
  };
}

export function generateRequestInformationData(
  partialRequestInformationData?: Partial<RequestInformationData>,
): RequestInformationData {
  return {
    transactionHash: getRandomTransactionHash(),
    requestAccount: getRandomEthereumAddress(),
    ...partialRequestInformationData,
  };
}

export function generateFulfillmentInformation(
  partialFulfillmentInformation?: Partial<FulfillmentInformation>,
): FulfillmentInformation {
  return {
    transactionHash: getRandomTransactionHash(),
    fillerAccount: getRandomEthereumAddress(),
    ...partialFulfillmentInformation,
  };
}

export function generateTransferData(partialTransferData?: Partial<TransferData>): TransferData {
  return {
    sourceChain: generateChain(),
    sourceAmount: generateTokenAmountData(),
    targetChain: generateChain(),
    targetAmount: generateTokenAmountData(),
    targetAccount: getRandomEthereumAddress(),
    validityPeriod: generateUInt256Data(),
    fees: generateTokenAmountData(),
    date: Date.now(),
    ...partialTransferData,
  };
}
