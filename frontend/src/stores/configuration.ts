import { defineStore } from 'pinia';

import { BeamerConfig, ChainWithTokens } from '@/types/config';

export const useConfiguration = defineStore('configuration', {
  state: () => ({
    chains: {} as BeamerConfig['chains'],
  }),
  actions: {
    setChainConfiguration(id: string, configuration: ChainWithTokens) {
      this.chains = { ...this.chains, [id]: configuration };
    },
  },
});
