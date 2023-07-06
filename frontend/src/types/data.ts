export type EthereumAddress = string; // TODO: to improve

export type TransactionHash = string; // TODO: to improve

export type NativeCurrency = {
  name: string;
  symbol: string;
  decimals: number;
};
export type Chain = {
  identifier: number;
  name: string;
  rpcUrl: string; // TODO: restrict more
  requestManagerAddress: EthereumAddress;
  fillManagerAddress: EthereumAddress;
  explorerUrl: string; // TODO: restrict more
  internalRpcUrl: string;
  feeSubAddress?: string;
  imageUrl?: string; // TODO: restrict more
  nativeCurrency?: NativeCurrency;
  disabled?: boolean;
  disabled_reason?: string;
  hidden?: boolean;
};

export type Token = {
  address: EthereumAddress;
  symbol: string;
  decimals: number;
  imageUrl?: string; // TODO: restrict more
  hidden?: boolean;
};

export const ETH: Token = {
  address: '',
  symbol: 'ETH',
  decimals: 18,
};
