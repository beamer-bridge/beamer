import { ethers } from 'ethers';
import type { Ref } from 'vue';
import { computed, ref, watch } from 'vue';

import { getRequestFee } from '@/services/transactions/request-manager';
import type { EthereumProvider } from '@/services/web3-provider';

export function useRequestFee(
  provider: Ref<EthereumProvider | undefined>,
  requestManagerAddress: Ref<string | undefined>,
) {
  const error = ref<string | undefined>(undefined);
  const amount = ref<number>(0);

  const show = computed(() => !!provider.value && !!requestManagerAddress);
  const formattedAmount = computed(() => ethers.utils.formatEther(amount.value));

  const updateRequestFeeAmount = async () => {
    error.value = '';

    if (!provider.value || !requestManagerAddress.value) {
      amount.value = 0;
      return;
    }

    try {
      amount.value = await getRequestFee(provider.value, requestManagerAddress.value);
    } catch (exception) {
      error.value = exception.message ?? 'Unknown failure.';
    }
  };

  watch([provider, requestManagerAddress], updateRequestFeeAmount, { immediate: true });

  return { show, amount, formattedAmount, error };
}
