import { defineStore } from 'pinia';

import { BeamerConfig, ChainWithTokens } from '@/types/config';

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
