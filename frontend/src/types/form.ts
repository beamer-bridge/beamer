import { BigNumber } from 'ethers';

export type RequestFormResult = {
  targetChainId: BigNumber;
  sourceTokenAddress: string;
  targetTokenAddress: string;
  targetAddress: string;
  amount: BigNumber;
};
