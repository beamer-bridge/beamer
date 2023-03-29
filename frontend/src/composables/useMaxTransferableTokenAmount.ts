import type { Ref } from 'vue';
import { ref, watch } from 'vue';

import { getAmountBeforeFees } from '@/services/transactions/request-manager';
import type { Chain } from '@/types/data';
import { TokenAmount } from '@/types/token-amount';

export function useMaxTransferableTokenAmount(
  totalTokenAmount: Ref<TokenAmount | undefined>,
  sourceChain: Ref<Chain | undefined>,
  targetChain: Ref<Chain | undefined>,
) {
  const maxTransferableTokenAmount: Ref<TokenAmount | undefined> = ref(undefined);
  const loading = ref(false);

  async function updateMaxTransferableTokenAmount(
    balance: TokenAmount,
    sourceChain: Chain,
    targetChain: Chain,
  ) {
    try {
      const transferableAmount = await getAmountBeforeFees(
        balance,
        sourceChain.internalRpcUrl,
        sourceChain.requestManagerAddress,
        targetChain.identifier,
      );
      maxTransferableTokenAmount.value = TokenAmount.new(transferableAmount, balance.token);
    } catch (e) {
      maxTransferableTokenAmount.value = undefined;
    }
  }

  async function handleBalanceChange() {
    if (!totalTokenAmount.value || !sourceChain.value || !targetChain.value) {
      maxTransferableTokenAmount.value = undefined;
      return;
    }

    loading.value = true;
    await updateMaxTransferableTokenAmount(
      totalTokenAmount.value,
      sourceChain.value,
      targetChain.value,
    );
    loading.value = false;
  }

  watch([totalTokenAmount, sourceChain, targetChain], handleBalanceChange, { immediate: true });

  return { maxTransferableTokenAmount, loading };
}
