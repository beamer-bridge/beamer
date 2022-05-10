import { BigNumber } from 'ethers';

export type EthereumAddress = string; // TODO: to improve

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

/*
 * The explicitly defined numeric values are important for the order of the
 * state progression and comparison between them.
 */
export enum RequestState {
  Init = 0,
  WaitConfirm = 1,
  WaitTransaction = 2,
  FailedSwitchChain = 3,
  WaitFulfill = 4,
  RequestSuccessful = 5,
  RequestFailed = 6,
}

export interface Request {
  amount: BigNumber;
  sourceChainId: number;
  sourceTokenAddress: string;
  targetAddress: string;
  targetChainId: number;
  targetTokenAddress: string;
  requestManagerAddress: string;
  fee: number;
  // Optional
  fillManagerAddress?: string;
  requestId?: BigNumber;
  validityPeriod?: number;
}

export interface RequestMetadata {
  amount: string;
  sourceChainName: string;
  targetAddress: string;
  targetChainName: string;
  tokenSymbol: string;
}
