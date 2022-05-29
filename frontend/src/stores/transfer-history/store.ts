import { defineStore } from 'pinia';

import type { Transfer } from '@/actions/transfers';

import { transferHistorySerializer } from './serializer';
import type { TransferHistoryState } from './types';

export const useTransferHistory = defineStore('transferHistory', {
  state: (): TransferHistoryState => ({
    transfers: [],
  }),
  actions: {
    addTransfer(transfer: Transfer): void {
      this.transfers.unshift(transfer);
    },
  },
  persist: {
    serializer: transferHistorySerializer,
  },
});
