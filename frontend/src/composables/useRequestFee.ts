import type { Ref } from 'vue';
import { computed, ref, watch } from 'vue';

import { getRequestFee } from '@/services/transactions/request-manager';
import { EthereumAmount } from '@/types/token-amount';

export function useRequestFee(
  rpcUrl: Ref<string | undefined>,
  requestManagerAddress: Ref<string | undefined>,
) {
  const error = ref<string | undefined>(undefined);
  const amount = ref<EthereumAmount>(new EthereumAmount('0'));

  const available = computed(() => !!rpcUrl.value && !!requestManagerAddress.value);
  const formattedAmount = computed(() => amount.value.format());

  const updateRequestFeeAmount = async () => {
    error.value = '';

    if (!rpcUrl.value || !requestManagerAddress.value) {
      amount.value = new EthereumAmount('0');
      return;
    }

    try {
      amount.value = await getRequestFee(rpcUrl.value, requestManagerAddress.value);
    } catch (exception: unknown) {
      const errorMessage = (exception as { message?: string }).message;
      error.value = errorMessage ?? 'Unknown failure.';
    }
  };

  watch([rpcUrl, requestManagerAddress], updateRequestFeeAmount, { immediate: true });

  return { available, amount, formattedAmount, error };
}
