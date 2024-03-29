import { defineStore } from 'pinia';

import type { BeamerConfig, ChainWithTokens } from '@/types/config';
import type { Token } from '@/types/data';

export const useConfiguration = defineStore('configuration', {
  state: (): BeamerConfig => ({
    chains: {},
  }),
  actions: {
    setConfiguration(configuration: BeamerConfig) {
      this.$patch(configuration);
    },
  },
  getters: {
    getTokensForChain:
      (state) =>
      (chainId: number): Token[] => {
        const chain = state.chains[chainId];
        if (!chain) {
          return [];
        }

        return chain.tokens;
      },
    getTokenForChain:
      (state) =>
      (chainId: number, tokenSymbol: string): Token | undefined => {
        const chain = state.chains[chainId];
        if (!chain) {
          return;
        }

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
