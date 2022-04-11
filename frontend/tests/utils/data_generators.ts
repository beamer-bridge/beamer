import { ChainConfig, Token } from '@/types/config';

const HEXADECIMAL_CHARACTERS = '0123456789abcdefABCDEF';
const ALPHABET_CHARACTERS = 'abcdefghijklmnopqrstuvwxyz';

function getRandomString(charSet: string, length: number, prefix = ''): string {
  let output = prefix;

  for (let i = 0; i < length; i++) {
    output += charSet.charAt(Math.floor(Math.random() * charSet.length));
  }

  return output;
}

function getRandomEthereumAddress(): string {
  return getRandomString(HEXADECIMAL_CHARACTERS, 32, '0x');
}

function getRandomUrl(subDomain: string): string {
  return getRandomString(ALPHABET_CHARACTERS, 8, `https://${subDomain}.`);
}

export function generateToken(partialToken?: Partial<Token>): Token {
  return {
    address: getRandomEthereumAddress(),
    symbol: getRandomString(ALPHABET_CHARACTERS, 3).toUpperCase(),
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
    name: getRandomString(ALPHABET_CHARACTERS, 8, 'name-'),
    tokens: [generateToken()],
    ...partialConfiguration,
  } as ChainConfig;
}
