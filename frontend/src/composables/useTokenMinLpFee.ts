import type { Ref } from 'vue';
import { computed, ref, watch } from 'vue';

import { getTokenMinLpFee } from '@/services/transactions/request-manager';
import type { Chain, Token } from '@/types/data';
import { TokenAmount } from '@/types/token-amount';
import type { UInt256 } from '@/types/uint-256';

export function useTokenMinLpFee(
  sourceChain: Ref<Chain | undefined>,
  targetChain: Ref<Chain | undefined>,
  token: Ref<Token | undefined>,
) {
  const minLpFee: Ref<UInt256 | undefined> = ref(undefined);

  const formattedMinFee = computed(() => {
    return minLpFee.value && token.value
      ? TokenAmount.new(minLpFee.value, token.value).formatFullValue()
      : undefined;
  });

  async function updateMinLpFee(sourceChain: Chain, targetChain: Chain, token: Token) {
    try {
      minLpFee.value = await getTokenMinLpFee(
        sourceChain.internalRpcUrl,
        sourceChain.requestManagerAddress,
        targetChain?.identifier,
        token.address,
      );
    } catch (e) {
      console.error(e);
      minLpFee.value = undefined;
    }
  }

  async function handleParamChange() {
    if (!token.value || !sourceChain.value || !targetChain.value) {
      minLpFee.value = undefined;
      return;
    }
    await updateMinLpFee(sourceChain.value, targetChain.value, token.value);
  }

  watch([sourceChain, targetChain, token], handleParamChange, { immediate: true });

  return { formattedMinFee };
}
