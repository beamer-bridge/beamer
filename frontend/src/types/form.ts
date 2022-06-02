import type { Chain, Token } from './data';

export type RequestFormResult = {
  amount: string;
  sourceChain: SelectorOption<Chain>;
  targetChain: SelectorOption<Chain>;
  toAddress: string;
  token: SelectorOption<Token>;
};

export type SelectorOption<T> = {
  label: string;
  value: T;
  imageUrl?: string;
};
