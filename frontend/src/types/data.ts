import { TransactionReceipt } from '@ethersproject/providers';
import { BigNumber } from 'ethers';
import { Ref } from 'vue';

export enum RequestState {
  Init,
  WaitConfirm,
  WaitTransaction,
  WaitSwitchChain,
  FailedSwitchChain,
  WaitFulfill,
  RequestSuccessful,
  RequestFailed,
}

export interface Request {
  amount: BigNumber;
  sourceChainId: number;
  sourceTokenAddress: string;
  targetAddress: string;
  targetChainId: number;
  targetTokenAddress: string;
  // Optional
  requestManagerAddress?: string;
  fillManagerAddress?: string;
  requestId?: BigNumber;
  receipt?: TransactionReceipt;
  fee?: number;
}

export interface RequestMetadata {
  state: Ref<RequestState>;
  amount: string;
  sourceChainName: string;
  targetAddress: string;
  targetChainName: string;
  tokenSymbol: string;
  fee: string;
}
