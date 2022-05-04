import { BigNumber } from 'ethers';

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
  amount: string | BigNumber;
  sourceChainId: number;
  sourceTokenAddress: string;
  targetAddress: string;
  targetChainId: number;
  targetTokenAddress: string;
  // Optional
  requestManagerAddress?: string;
  fillManagerAddress?: string;
  requestId?: BigNumber;
  fee?: number;
  validityPeriod?: number;
}

export interface RequestMetadata {
  amount: string;
  sourceChainName: string;
  targetAddress: string;
  targetChainName: string;
  tokenSymbol: string;
}
