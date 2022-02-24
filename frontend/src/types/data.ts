import { TransactionReceipt} from '@ethersproject/providers';
import { BigNumber} from 'ethers';

export enum RequestState {
  WaitConfirm,
  WaitTransaction,
  WaitFulfill,
  Successful,
  Failed,
}

export interface Request {
	state: RequestState,
	amount: BigNumber,
	sourceTokenAddress: string,
	targetAddress: string,
	targetChainId: BigNumber,
	targetTokenAddress: string,
	// Optional
	requestManagerAddress?: string,
	fillManagerAddress?: string,
	requestId?: BigNumber,
	receipt?: TransactionReceipt,
	fee?: number,
}
