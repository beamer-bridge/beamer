import { defineStore } from 'pinia';

import type { WalletType } from '@/types/settings';

export const useSettings = defineStore('settings', {
  state: () => ({
    connectedWallet: undefined as WalletType | undefined,
    disclaimerChecked: false,
  }),
  persist: true,
});
