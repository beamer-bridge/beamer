import type { Chain, Token } from '@/types/data';

export type RequestSource = {
  amount: string;
  sourceChain: SelectorOption<Chain> | null;
  token: SelectorOption<Token> | null;
};

export type ValidRequestSource = {
  amount: string;
  sourceChain: SelectorOption<Chain>;
  token: SelectorOption<Token>;
};

export type RequestTarget = {
  targetChain: SelectorOption<Chain> | null;
  toAddress: string;
};

export type ValidRequestTarget = {
  targetChain: SelectorOption<Chain>;
  toAddress: string;
};

export type SelectorOption<T> = {
  label: string;
  value: T;
  imageUrl?: string;
  disabled?: boolean;
  disabled_reason?: string;
  hidden?: boolean;
};
