import type { Ref } from 'vue';
import { ref, watch } from 'vue';

import { getRequestFee } from '@/services/transactions/request-manager';
import { TokenAmount } from '@/types/token-amount';

export function useRequestFee(
  rpcUrl: Ref<string | undefined>,
  requestManagerAddress: Ref<string | undefined>,
  requestAmount: Ref<TokenAmount | undefined>,
) {
  const error = ref<string | undefined>(undefined);
  const amount = ref<TokenAmount | undefined>(undefined);

  const updateRequestFeeAmount = async () => {
    error.value = '';

    if (!rpcUrl.value || !requestManagerAddress.value || !requestAmount.value) {
      amount.value = undefined;
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
  };

  watch([rpcUrl, requestManagerAddress, requestAmount], updateRequestFeeAmount, {
    immediate: true,
  });

  return { amount, error };
}
