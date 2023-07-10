import type { Ref } from 'vue';
import { ref, watch } from 'vue';

import { useDebouncedTask } from '@/composables/useDebouncedTask';
import { amountCanBeSubsidized } from '@/services/transactions/fee-sub';
import { getRequestFee } from '@/services/transactions/request-manager';
import type { Chain } from '@/types/data';
import { TokenAmount } from '@/types/token-amount';
import { UInt256 } from '@/types/uint-256';

export function useRequestFee(
  rpcUrl: Ref<string | undefined>,
  requestManagerAddress: Ref<string | undefined>,
  requestAmount: Ref<TokenAmount | undefined>,
  sourceChain: Ref<Chain | undefined>,
  targetChain: Ref<Chain | undefined>,
  debounced?: boolean,
  debouncedDelay = 500,
) {
  const error = ref<string | undefined>(undefined);
  const amount = ref<TokenAmount | undefined>(undefined);
  const loading = ref<boolean>(false);

  const updateRequestFeeAmount = async () => {
    loading.value = true;
    error.value = '';

    if (
      !rpcUrl.value ||
      !requestManagerAddress.value ||
      !requestAmount.value ||
      !targetChain.value ||
      !sourceChain.value
    ) {
      amount.value = undefined;
      loading.value = false;
      return;
    }

    try {
      const canBeSubsdized = await amountCanBeSubsidized(
        sourceChain.value,
        targetChain.value,
        requestAmount.value.token,
        requestAmount.value,
      );
      let requestFee;
      if (canBeSubsdized) {
        requestFee = new UInt256(0);
      } else {
        requestFee = await getRequestFee(
          rpcUrl.value,
          requestManagerAddress.value,
          requestAmount.value,
          targetChain.value.identifier,
        );
      }
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
    [rpcUrl, requestManagerAddress, targetChain, requestAmount],
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
