import { defineStore } from 'pinia';

import { WalletType } from '@/types/settings';

export const useSettings = defineStore('settings', {
  state: () => ({
    connectedWallet: undefined as WalletType | undefined,
  }),
  persist: true,
});
