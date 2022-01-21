export type RaisyncConfig = {
  chains: {
    [chainId: string]: ChainConfig;
  };
};

export type ChainConfig = {
  requestManagerAddress: string;
  explorerTransactionUrl: string;
};
