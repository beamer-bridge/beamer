import type { Ref } from 'vue';
import { ref, watch } from 'vue';

import { useDebouncedTask } from '@/composables/useDebouncedTask';
import { getRequestFee } from '@/services/transactions/request-manager';
import { TokenAmount } from '@/types/token-amount';

export function useRequestFee(
  rpcUrl: Ref<string | undefined>,
  requestManagerAddress: Ref<string | undefined>,
  requestAmount: Ref<TokenAmount | undefined>,
  debounced?: boolean,
  debouncedDelay = 500,
) {
  const error = ref<string | undefined>(undefined);
  const amount = ref<TokenAmount | undefined>(undefined);
  const loading = ref<boolean>(false);

  const updateRequestFeeAmount = async () => {
    loading.value = true;
    error.value = '';

    if (!rpcUrl.value || !requestManagerAddress.value || !requestAmount.value) {
      amount.value = undefined;
      loading.value = false;
      return;
    }

    try {
      const requestFee = await getRequestFee(
        rpcUrl.value,
        requestManagerAddress.value,
        requestAmount.value.uint256,
      );
      amount.value = TokenAmount.new(requestFee, requestAmount.value.token);
    } catch (exception: unknown) {
      const errorMessage = (exception as { message?: string }).message;
      console.error(errorMessage);
      error.value = errorMessage ?? 'Unknown failure.';
    }

    loading.value = false;
  };

  const callback = debounced
    ? useDebouncedTask(updateRequestFeeAmount, debouncedDelay)
    : updateRequestFeeAmount;

  watch(
    [rpcUrl, requestManagerAddress, requestAmount],
    () => {
      // Prevent loading indicator spinning on page load
      if (!requestAmount.value) {
        amount.value = undefined;
        error.value = '';
        return;
      }

      loading.value = true;
      callback();
    },
    {
      immediate: true,
    },
  );

  return { amount, loading, error };
}
