export type BeamerConfig = {
  chains: ChainConfigMapping;
};

export type ChainConfigMapping = {
  [chainId: string]: ChainConfig;
};

export type ChainConfig = {
  requestManagerAddress: string;
  fillManagerAddress: string;
  explorerTransactionUrl: string;
  rpcUrl: string;
  name: string;
  tokens: readonly Token[];
};

export type Token = {
  address: string;
  symbol: string;
};
