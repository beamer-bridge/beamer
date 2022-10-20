import type { Ref } from 'vue';
import { ref, watch } from 'vue';

import { getAmountBeforeFees } from '@/services/transactions/request-manager';
import type { Chain } from '@/types/data';
import { TokenAmount } from '@/types/token-amount';

export function useMaxTransferableTokenAmount(
  totalTokenAmount: Ref<TokenAmount | undefined>,
  chain: Ref<Chain | undefined>,
) {
  const maxTransferableTokenAmount: Ref<TokenAmount | undefined> = ref(undefined);
  const loading = ref(false);

  async function updateMaxTransferableTokenAmount(balance: TokenAmount, chain: Chain) {
    try {
      const transferableAmount = await getAmountBeforeFees(
        balance.uint256,
        chain.rpcUrl,
        chain.requestManagerAddress,
      );
      maxTransferableTokenAmount.value = TokenAmount.new(transferableAmount, balance.token);
    } catch (e) {
      maxTransferableTokenAmount.value = undefined;
    }
  }

  async function handleBalanceChange() {
    if (!totalTokenAmount.value || !chain.value) {
      maxTransferableTokenAmount.value = undefined;
      return;
    }
    loading.value = true;
    await updateMaxTransferableTokenAmount(totalTokenAmount.value, chain.value);
    loading.value = false;
  }

  watch(totalTokenAmount, handleBalanceChange, { immediate: true });

  return { maxTransferableTokenAmount, loading };
}
