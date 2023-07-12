import { ChainMetadata } from 'config/chains/chain';
import type { ChainDeploymentInfo, DeploymentInfoData } from 'config/deployment';
import { DeploymentInfo } from 'config/deployment';
import { TokenMetadata } from 'config/tokens/token';

import type { StepData } from '@/actions/steps';
import type {
  AllowanceInformationData,
  RequestInformationData,
  SubsidizedTransferData,
  TransactionInformationData,
  TransferData,
} from '@/actions/transfers';
import { isSubsidizedTransferData, SubsidizedTransfer, Transfer } from '@/actions/transfers';
import type { RequestFulfillmentData } from '@/actions/transfers/request-fulfillment';
import type { BeamerConfig, ChainWithTokens } from '@/types/config';
import type { Chain, EthereumAddress, Token, TransactionHash } from '@/types/data';
import type { SelectorOption } from '@/types/form';
import type { TokenAmountData } from '@/types/token-amount';
import type { UInt256Data } from '@/types/uint-256';

const HEXADECIMAL_CHARACTERS = '0123456789abcdefABCDEF';
export const DECIMAL_CHARACTERS = '0123456789';
export const ALPHABET_CHARACTERS = 'abcdefghijklmnopqrstuvwxyz';

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
    internalRpcUrl: getRandomUrl('internalRpc'),
    requestManagerAddress: getRandomEthereumAddress(),
    fillManagerAddress: getRandomEthereumAddress(),
    explorerUrl: getRandomUrl('explorer'),
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
  return value ?? getRandomNumber(100000000000000000, 50000000000000000000).toString();
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
    requestAccount: getRandomEthereumAddress(),
    ...partialRequestInformationData,
  };
}

export function generateRequestFulfillmentData(
  partialRequestFulfillmentData?: Partial<RequestFulfillmentData>,
): RequestFulfillmentData {
  return {
    timestamp: getRandomNumber(),
    ...partialRequestFulfillmentData,
  };
}

export function generateTransactionInformationData(
  partialTransactionInformationData?: Partial<TransactionInformationData>,
): TransactionInformationData {
  return {
    ...partialTransactionInformationData,
  };
}

export function generateAllowanceInformationData(
  partialAllowanceInformationData?: Partial<AllowanceInformationData>,
): AllowanceInformationData {
  return {
    ...partialAllowanceInformationData,
  };
}

export function generateTransferData(
  partialTransferData?: Partial<TransferData | SubsidizedTransferData>,
): TransferData {
  return {
    sourceChain: generateChain(),
    sourceAmount: generateTokenAmountData(),
    targetChain: generateChain(),
    targetAmount: generateTokenAmountData(),
    targetAccount: getRandomEthereumAddress(),
    validityPeriod: generateUInt256Data(),
    fees: generateTokenAmountData(),
    date: Date.now(),
    claimCount: getRandomNumber(),
    requestInformation: generateRequestInformationData(),
    ...partialTransferData,
  };
}

export function generateTransfer(options?: {
  transferData?: Partial<TransferData>;
  active?: boolean;
  completed?: boolean;
  failed?: boolean;
  expired?: boolean;
}): Transfer {
  const temporaryTransfer = new Transfer(generateTransferData());
  const steps = [...temporaryTransfer.steps];
  let transferData = options?.transferData ?? {};

  if (options?.active) {
    steps[0].complete();
    steps[1].activate();
  }

  if (options?.completed) {
    steps.forEach((step) => step.complete());
    transferData = {
      requestInformation: generateRequestInformationData({
        transactionHash: getRandomTransactionHash(),
      }),
      requestFulfillment: generateRequestFulfillmentData(),
      ...transferData,
    };
  }

  if (options?.failed) {
    steps[0].complete();
    steps[1].setErrorMessage('error message');
  }

  if (options?.expired !== undefined) {
    transferData.expired = options.expired;
  }

  const data = generateTransferData({ ...transferData, steps });

  if (isSubsidizedTransferData(data)) {
    return new SubsidizedTransfer(data);
  }
  return new Transfer(data);
}

export function generateChainMetadata(
  partialChainMetadata?: Partial<ChainMetadata>,
): ChainMetadata {
  return new ChainMetadata({
    identifier: getRandomNumber(),
    name: getRandomChainName(),
    rpcUrl: getRandomUrl('rpc'),
    internalRpcUrl: getRandomUrl('internalRpc'),
    explorerUrl: getRandomUrl('explorer'),
    tokenSymbols: [getRandomTokenSymbol()],
    ...partialChainMetadata,
  });
}

export function generateTokenMetadata(
  partialTokenMetadata?: Partial<TokenMetadata>,
): TokenMetadata {
  return new TokenMetadata({
    addresses: {
      [getRandomNumber()]: getRandomEthereumAddress(),
    },
    symbol: getRandomTokenSymbol(),
    decimals: getRandomNumber(0, 18),
    ...partialTokenMetadata,
  });
}
export function getDeploymentFolderName() {
  const folderNames = ['mainnet', 'ganache-local', getRandomString(ALPHABET_CHARACTERS, 10)];
  return folderNames[Math.floor(Math.random() * folderNames.length)];
}

export function generateChainDeploymentInfo(
  partialChainDeploymentInfo?: Partial<ChainDeploymentInfo>,
): ChainDeploymentInfo {
  return {
    RequestManager: {
      address: getRandomEthereumAddress(),
    },
    FillManager: {
      address: getRandomEthereumAddress(),
    },
    ...partialChainDeploymentInfo,
  };
}

export function generateDeploymentInfo(
  partialDeploymentInfoData?: Partial<DeploymentInfoData>,
): DeploymentInfo {
  const chain_id = getRandomNumber().toString();
  return new DeploymentInfo({
    chains: {
      [chain_id]: {
        chain: generateChainDeploymentInfo(),
      },
    },
    folderName: getDeploymentFolderName(),
    ...partialDeploymentInfoData,
  });
}

export function generateBeamerConfig(partialBeamerConfig?: Partial<BeamerConfig>): BeamerConfig {
  return {
    chains: {
      [getRandomNumber()]: generateChainWithTokens(),
    },
    ...partialBeamerConfig,
  };
}

export function generateChainSelectorOption(partialChain?: Partial<Chain>): SelectorOption<Chain> {
  const chain = generateChain(partialChain);
  return {
    label: chain.name,
    value: chain,
    imageUrl: chain.imageUrl,
    disabled: chain.disabled,
    disabled_reason: chain.disabled_reason,
  };
}

export function generateTokenSelectorOption(partialToken?: Partial<Token>): SelectorOption<Token> {
  const token = generateToken(partialToken);
  return {
    label: token.symbol,
    value: token,
    imageUrl: token.imageUrl,
  };
}
