import type { StateTree } from 'pinia';
import type { Serializer } from 'pinia-plugin-persistedstate';

import type { TransferData } from '@/actions/transfers';
import { Transfer } from '@/actions/transfers';

import type { TransferHistoryState } from './types';

export const transferHistorySerializer: Serializer = {
  serialize: (state: StateTree): string => {
    return JSON.stringify({
      transfers: (state as TransferHistoryState).transfers.map((transfer) => transfer.encode()),
    });
  },
  deserialize: (rawState: string): TransferHistoryState => {
    const encodedState = JSON.parse(rawState);
    const state = { transfers: [] };

    if (typeof encodedState !== 'object') {
      console.error('Failed to load unknown format for transfer history store!');
    } else {
      state.transfers = (encodedState.transfers ?? []).map(
        (data: TransferData) => new Transfer(data),
      );
    }

    return state;
  },
};
