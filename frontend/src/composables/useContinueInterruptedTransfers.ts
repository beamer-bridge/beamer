import type { Ref } from 'vue';
import { watch } from 'vue';

import type { Transfer } from '@/actions/transfers';

export function continueInterruptedTransfers(transfers: Array<Transfer>) {
  for (const transfer of transfers) {
    const wasInterrupted = !transfer.completed && !transfer.failed;

    if (wasInterrupted) {
      transfer.execute().catch((error) => {
        console.error('Failed to continue interrupted transfer!');
        console.error(error);
      });
    }
  }
}

/*
 * This composable does not use an `immediate` watcher, but a workaround,
 * because for an immediate watcher call the stop function is not defined yet.
 */
export function useContinueInterruptedTransfers(
  transfers: Ref<Array<Transfer>>,
  transfersAreLoaded: Ref<boolean>,
) {
  if (transfersAreLoaded.value) {
    continueInterruptedTransfers(transfers.value);
  } else {
    const stopLoadedWatcher = watch(transfersAreLoaded, () => {
      if (transfersAreLoaded.value) {
        stopLoadedWatcher();
        continueInterruptedTransfers(transfers.value);
      }
    });
  }
}
