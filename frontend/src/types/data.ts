import type { UInt256 } from './uint-256';

export type EthereumAddress = string; // TODO: to improve

export type TransactionHash = string; // TODO: to improve

export type Chain = {
  identifier: number;
  name: string;
  rpcUrl: string; // TODO: restrict more
  requestManagerAddress: EthereumAddress;
  fillManagerAddress: EthereumAddress;
  explorerUrl: string; // TODO: restrict more
  imageUrl?: string; // TODO: restrict more
};

export type Token = {
  address: EthereumAddress;
  symbol: string;
  decimals: number;
  imageUrl?: string; // TODO: restrict more
};

export type TokenAttributes = {
  transferLimit: UInt256;
  minLpFee: UInt256;
  lpFeePPM: UInt256;
  protocolFeePPM: UInt256;
  collectedProtocolFees: UInt256;
};

export type TokenWithAttributes = Token & TokenAttributes;

export const ETH: Token = {
  address: '',
  symbol: 'ETH',
  decimals: 18,
};
