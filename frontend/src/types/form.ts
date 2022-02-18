import { BigNumber } from 'ethers';

export type RequestFormResult = {
  targetChainId: BigNumber;
  sourceTokenAddress: string;
  targetTokenAddress: string;
  targetAddress: string;
  amount: BigNumber;
};

export type SelectorOption = {
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any;
  imageUrl?: string;
};
