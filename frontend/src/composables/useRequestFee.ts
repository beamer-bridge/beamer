import type { Ref } from 'vue';
import { computed, ref, watch } from 'vue';

import { getRequestFee } from '@/services/transactions/request-manager';
import type { EthereumProvider } from '@/services/web3-provider';
import { EthereumAmount } from '@/types/token-amount';

export function useRequestFee(
  provider: Ref<EthereumProvider | undefined>,
  requestManagerAddress: Ref<string | undefined>,
) {
  const error = ref<string | undefined>(undefined);
  const amount = ref<EthereumAmount>(new EthereumAmount('0'));

  const available = computed(() => !!provider.value && !!requestManagerAddress.value);
  const formattedAmount = computed(() => amount.value.formattedAmount);

  const updateRequestFeeAmount = async () => {
    error.value = '';

    if (!provider.value || !requestManagerAddress.value) {
      amount.value = new EthereumAmount('0');
      return;
    }

    try {
      amount.value = await getRequestFee(provider.value, requestManagerAddress.value);
    } catch (exception: unknown) {
      const errorMessage = (exception as { message?: string }).message;
      error.value = errorMessage ?? 'Unknown failure.';
    }
  };

  watch([provider, requestManagerAddress], updateRequestFeeAmount, { immediate: true });

  return { available, amount, formattedAmount, error };
}
