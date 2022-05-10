import type { Chain, Token } from './data';

export interface ChainWithTokens extends Chain {
  tokens: Array<Token>;
}

export type BeamerConfig = {
  chains: ChainConfigMapping;
};

export type ChainConfigMapping = {
  [chainIdentifier: string]: ChainWithTokens;
};
