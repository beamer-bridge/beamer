import type { Ref } from 'vue';
import { watch } from 'vue';

import type { Transfer } from '@/actions/transfers';
import type { IEthereumWallet } from '@/services/web3-provider';

export function continueInterruptedTransfers(
  transfers: Array<Transfer>,
  provider: IEthereumWallet,
) {
  for (const transfer of transfers) {
    const wasInterrupted = !transfer.completed && !transfer.failed;

    if (wasInterrupted) {
      transfer.execute(provider).catch((error) => {
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
  provider: Ref<IEthereumWallet | undefined>,
) {
  if (transfersAreLoaded.value && provider.value) {
    continueInterruptedTransfers(transfers.value, provider.value);
  } else {
    const stopLoadedWatcher = watch([transfersAreLoaded, provider], () => {
      if (transfersAreLoaded.value && provider.value) {
        stopLoadedWatcher();
        continueInterruptedTransfers(transfers.value, provider.value);
      }
    });
  }
}
