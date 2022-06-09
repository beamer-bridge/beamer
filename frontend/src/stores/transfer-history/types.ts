import type { StateTree } from 'pinia';

import type { Transfer } from '@/actions/transfers';

export interface TransferHistoryState extends StateTree {
  transfers: Array<Transfer>;
  loaded: boolean;
}
