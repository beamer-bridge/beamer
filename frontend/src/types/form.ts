export type RequestFormResult = {
  amount: string;
  sourceChainId: SelectorOption<number>;
  targetChainId: SelectorOption<number>;
  toAddress: string;
  tokenAddress: SelectorOption<string>;
};

export type SelectorOption<T> = {
  label: string;
  value: T;
  imageUrl?: string;
};
