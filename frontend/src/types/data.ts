import { TransactionReceipt } from '@ethersproject/providers';
import { BigNumber } from 'ethers';
import { Ref } from 'vue';

export enum RequestState {
  Init,
  WaitConfirm,
  WaitSwitchChain,
  FailedSwitchChain,
  WaitFulfill,
  RequestSuccessful,
  RequestFailed,
}

export interface Request {
  amount: BigNumber;
  sourceTokenAddress: string;
  sourceChainId: BigNumber;
  targetAddress: string;
  targetChainId: BigNumber;
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
