export type RaisyncConfig = {
  chains: {
    [chainId: string]: ChainConfig;
  };
};

export type ChainConfig = {
  requestManagerAddress: string;
  fillManagerAddress: string;
  explorerTransactionUrl: string;
  name: string;
  tokens: readonly Token[];
};

export type Token = {
  address: string;
  symbol: string;
};
