import type { Ref } from 'vue';
import { ref, watch } from 'vue';

import { getTransferLimit } from '@/services/transactions/request-manager';
import type { Chain, Token } from '@/types/data';
import { TokenAmount } from '@/types/token-amount';

export function useTransferLimit(chain: Ref<Chain | undefined>, token: Ref<Token | undefined>) {
  const transferLimitTokenAmount: Ref<TokenAmount | undefined> = ref(undefined);

  async function updateTransferLimit(token: Token, chain: Chain) {
    try {
      const transferLimit = await getTransferLimit(chain.rpcUrl, chain.requestManagerAddress);
      transferLimitTokenAmount.value = TokenAmount.new(transferLimit, token);
    } catch (e) {
      console.error(e);
      transferLimitTokenAmount.value = undefined;
    }
  }

  async function handleParamChange() {
    if (!token.value || !chain.value) {
      transferLimitTokenAmount.value = undefined;
      return;
    }
    await updateTransferLimit(token.value, chain.value);
  }

  watch([chain, token], handleParamChange, { immediate: true });

  return { transferLimitTokenAmount };
}
