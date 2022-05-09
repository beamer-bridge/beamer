import { defineStore } from 'pinia';

import { Settings, WalletType } from '@/types/settings';

export const useSettings = defineStore('settings', {
  state: () => ({
    settings: undefined as Settings,
  }),
  actions: {
    setConnectedWallet(connectedWallet: WalletType) {
      this.settings = { ...this.settings, connectedWallet };
    },
  },
  getters: {
    connectedWallet: (state): WalletType | undefined => state.settings?.connectedWallet,
  },
  persist: {
    enabled: true,
    strategies: [
      {
        storage: localStorage,
      },
    ],
  },
});
