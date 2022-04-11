import { defineStore } from 'pinia';

import { BeamerConfig, ChainConfig } from '@/types/config';

export const useConfiguration = defineStore('configuration', {
  state: () => ({
    chains: {} as BeamerConfig['chains'],
  }),
  actions: {
    setChainConfiguration(id: string, configuration: ChainConfig) {
      this.chains = { ...this.chains, [id]: configuration };
    },
  },
});
