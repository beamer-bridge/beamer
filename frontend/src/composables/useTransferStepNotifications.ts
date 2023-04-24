import type { Ref } from 'vue';
import { computed, watch } from 'vue';
import { useToast } from 'vue-toastification';

import type { Transfer } from '@/actions/transfers';

export function useTransferStepNotifications(transfers: Ref<Array<Transfer>>) {
  const toast = useToast();

  const activeTransfers = computed(() => {
    return transfers.value.filter((transfer) => !transfer.done);
  });

  const setupListeners = () => {
    for (const transfer of activeTransfers.value) {
      transfer.removeAllListeners();

      transfer.on('completed', () => {
        toast.success(`Transfer completed!`, {
          timeout: false,
        });
      });
    }
  };

  watch(
    activeTransfers,
    () => {
      setupListeners();
    },
    { immediate: true },
  );
}
