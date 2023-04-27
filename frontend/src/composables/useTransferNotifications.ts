import type { Ref } from 'vue';
import { computed, watch } from 'vue';
import { useToast } from 'vue-toastification';

import type { Transfer } from '@/actions/transfers';
import TransferComplete from '@/components/notifications/TransferComplete.vue';

export function useTransferNotifications(transfers: Ref<Array<Transfer>>) {
  const toast = useToast();

  const activeTransfers = computed(() => {
    return transfers.value.filter((transfer) => !transfer.done);
  });

  const removeTransferListeners = (transfer: Transfer) => {
    transfer.removeAllListeners();
  };

  const onTransferCompleted = (transfer: Transfer) => {
    toast.success({
      component: TransferComplete,
      props: { transfer },
    });
  };

  const setupListeners = () => {
    for (const transfer of activeTransfers.value) {
      removeTransferListeners(transfer);

      transfer.once('completed', () => {
        onTransferCompleted(transfer);
        removeTransferListeners(transfer);
      });
      transfer.once('failed', () => {
        removeTransferListeners(transfer);
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
