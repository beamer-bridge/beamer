import type { Ref } from 'vue';
import { computed, watch } from 'vue';

import type { Transfer } from '@/actions/transfers';

export function useClaimCountListeners(transfers: Ref<Array<Transfer>>) {
  const expiredAndNotWithdrawnTransfers = computed(() =>
    transfers.value.filter((transfer) => transfer.expired && !transfer.withdrawn),
  );

  const expiredAndWithdrawnTransfers = computed(() =>
    transfers.value.filter((transfer) => transfer.expired && transfer.withdrawn),
  );

  watch(
    expiredAndNotWithdrawnTransfers,
    (transfers) => {
      transfers.forEach(async (transfer) => {
        // Sync state of transfers before subscribing to events
        await transfer.checkAndUpdateState();
        if (!transfer.hasActiveListeners && !transfer.withdrawn) {
          transfer.startClaimEventListeners();
        }
      });
    },
    { immediate: true },
  );

  watch(expiredAndWithdrawnTransfers, (transfers) => {
    transfers.forEach((transfer) => {
      if (transfer.hasActiveListeners) {
        transfer.stopEventListeners();
      }
    });
  });
}
