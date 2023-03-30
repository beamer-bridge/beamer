import type { Ref } from 'vue';
import { computed, ref, watch } from 'vue';

import { getTokenTransferLimit } from '@/services/transactions/request-manager';
import type { Chain, Token } from '@/types/data';
import { TokenAmount } from '@/types/token-amount';
import type { UInt256 } from '@/types/uint-256';

export function useTokenTransferLimit(
  chain: Ref<Chain | undefined>,
  token: Ref<Token | undefined>,
) {
  const transferLimit: Ref<UInt256 | undefined> = ref(undefined);

  const transferLimitTokenAmount = computed(() => {
    return transferLimit.value && token.value
      ? TokenAmount.new(transferLimit.value, token.value)
      : undefined;
  });

  async function updateTokenAttributes(chain: Chain, token: Token) {
    try {
      transferLimit.value = await getTokenTransferLimit(
        chain.internalRpcUrl,
        chain.requestManagerAddress,
        token.address,
      );
    } catch (e) {
      console.error(e);
      transferLimit.value = undefined;
    }
  }

  async function handleParamChange() {
    if (!token.value || !chain.value) {
      transferLimit.value = undefined;
      return;
    }
    await updateTokenAttributes(chain.value, token.value);
  }

  watch([token, chain], handleParamChange, { immediate: true });

  return { transferLimitTokenAmount };
}
