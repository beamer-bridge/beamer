export type EthereumAddress = string; // TODO: to improve

export type TransactionHash = string; // TODO: to improve

export type Chain = {
  identifier: number;
  name: string;
  rpcUrl: string; // TODO: restrict more
  requestManagerAddress: EthereumAddress;
  fillManagerAddress: EthereumAddress;
  explorerTransactionUrl: string; // TODO: restrict more
};

export type Token = {
  address: EthereumAddress;
  symbol: string;
  decimals: number;
};

export const ETH: Token = {
  address: '',
  symbol: 'ETH',
  decimals: 18,
};
