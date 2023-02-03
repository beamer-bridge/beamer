import { defineStore } from 'pinia';

import type { Transfer } from '@/actions/transfers';

import { transferHistorySerializer } from './serializer';
import type { TransferHistoryState } from './types';

export function getAppMajorVersion(semVer: string): string {
  return semVer.split('.')[0] || '0';
}

export function getStoreName(appVersion: string): string {
  if (appVersion === '0') {
    return 'transferHistory';
  } else {
    return `transferHistory_${appVersion}`;
  }
}

export const useTransferHistory = defineStore(
  getStoreName(getAppMajorVersion(APP_RELEASE.VERSION)),
  {
    state: (): TransferHistoryState => ({
      transfers: [],
      loaded: false,
    }),
    actions: {
      addTransfer(transfer: Transfer): void {
        this.transfers.unshift(transfer);
      },
    },
    getters: {
      hasPendingTransactionsForChain:
        (state) =>
        (chainId: number): boolean => {
          const pendingTransactions = state.transfers.filter((transfer) => {
            const hasActiveSteps = transfer.steps.slice(0, 3).some((step) => step.active);
            return (
              transfer.sourceChain.identifier === chainId &&
              !transfer.expired &&
              !transfer.withdrawn &&
              hasActiveSteps
            );
          }) as Transfer[];

          return pendingTransactions.length > 0;
        },
    },
    persist: {
      serializer: transferHistorySerializer,
    },
  },
);
