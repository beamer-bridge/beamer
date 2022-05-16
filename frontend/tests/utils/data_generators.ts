import { ChainConfig, Token } from '@/types/config';
import { RequestMetadata } from '@/types/data';

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

export function generateToken(partialToken?: Partial<Token>): Token {
  return {
    address: getRandomEthereumAddress(),
    symbol: getRandomTokenSymbol(),
    ...partialToken,
  } as Token;
}

export function generateChainConfiguration(
  partialConfiguration?: Partial<ChainConfig>,
): ChainConfig {
  return {
    requestManagerAddress: getRandomEthereumAddress(),
    fillManagerAddress: getRandomEthereumAddress(),
    explorerTransactionUrl: getRandomUrl('explorer'),
    rpcUrl: getRandomUrl('rpc'),
    name: getRandomChainName(),
    tokens: [generateToken()],
    ...partialConfiguration,
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
