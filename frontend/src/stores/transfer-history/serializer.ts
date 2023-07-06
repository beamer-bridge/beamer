import type { StateTree } from 'pinia';
import type { Serializer } from 'pinia-plugin-persistedstate';

import type { StepData } from '@/actions/steps';
import type { TransferData } from '@/actions/transfers';
import { SubsidizedTransfer, Transfer } from '@/actions/transfers';
import type { ExtendedTransferData } from '@/actions/transfers/types';

import type { TransferHistoryState } from './types';

export const transferHistorySerializer: Serializer = {
  serialize: (state: StateTree): string => {
    return JSON.stringify({
      transfers: (state as TransferHistoryState).transfers.map((transfer) => transfer.encode()),
    });
  },
  deserialize: (rawState: string): TransferHistoryState => {
    const encodedState = JSON.parse(rawState);
    const state = { transfers: [], loaded: false };

    if (typeof encodedState !== 'object') {
      console.error('Failed to load unknown format for transfer history store!');
    } else {
      const { transfers = [] } = encodedState;
      const inactiveTransfers = transfers.map(markTransferInactive);
      state.transfers = inactiveTransfers.map((data: ExtendedTransferData) => {
        if (data.feeSubAddress) {
          return new SubsidizedTransfer(data);
        } else {
          return new Transfer(data);
        }
      });
    }

    state.loaded = true;
    return state;
  },
};

/*
 * The purpose of marking transfers as inactive is to allow continuing
 * interrupted transfers that get reloaded to the store. Else the transfer still
 * counts as active, which does not mean that it is not completed yet, but that
 * the steps get actively executed right now, which is not the case (anymore).
 */
function markTransferInactive(data: TransferData): TransferData {
  if (data.steps) {
    data.steps = data.steps.map((step: StepData) => ({ ...step, active: false }));
  }

  return data;
}
