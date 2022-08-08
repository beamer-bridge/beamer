import { defineStore } from 'pinia';

import type { BeamerConfig, ChainWithTokens } from '@/types/config';
import type { Token } from '@/types/data';

export const useConfiguration = defineStore('configuration', {
  state: (): BeamerConfig => ({
    chains: {},
  }),
  actions: {
    setChainConfiguration(id: string, configuration: ChainWithTokens) {
      this.chains = { ...this.chains, [id]: configuration };
    },
  },
  getters: {
    getTokenForChain:
      (state) =>
      (chainId: number, tokenSymbol: string): Token | undefined => {
        const chain = state.chains[chainId];
        if (!chain) return;

        return chain.tokens.find((token) => token.symbol === tokenSymbol);
      },
    getChain:
      (state) =>
      (chainId: number): ChainWithTokens | undefined => {
        return state.chains[chainId];
      },
    isSupportedChain: (state) => {
      return (chainId: number): boolean => chainId in state.chains;
    },
    rpcUrls: (state) => {
      const rpcUrls = Object.keys(state.chains).reduce((prev, curr) => {
        return { ...prev, [curr]: state.chains[curr].rpcUrl };
      }, {});
      return rpcUrls;
    },
  },
});
