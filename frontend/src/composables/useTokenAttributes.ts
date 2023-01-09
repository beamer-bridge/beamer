import type { Ref } from 'vue';
import { computed, ref, watch } from 'vue';

import { getTokenAttributes } from '@/services/transactions/request-manager';
import type { Chain, Token, TokenAttributes } from '@/types/data';
import { TokenAmount } from '@/types/token-amount';

export function useTokenAttributes(chain: Ref<Chain | undefined>, token: Ref<Token | undefined>) {
  const tokenAttributes: Ref<TokenAttributes | undefined> = ref(undefined);

  const transferLimitTokenAmount = computed(() => {
    return tokenAttributes.value?.transferLimit && token.value
      ? TokenAmount.new(tokenAttributes.value.transferLimit, token.value)
      : undefined;
  });

  const formattedMinFee = computed(() => {
    return tokenAttributes.value?.minLpFee && token.value
      ? TokenAmount.new(tokenAttributes.value.minLpFee, token.value).formatFullValue()
      : undefined;
  });

  async function updateTokenAttributes(chain: Chain, token: Token) {
    try {
      tokenAttributes.value = await getTokenAttributes(
        chain.rpcUrl,
        chain.requestManagerAddress,
        token.address,
      );
    } catch (e) {
      console.error(e);
      tokenAttributes.value = undefined;
    }
  }

  async function handleParamChange() {
    if (!token.value || !chain.value) {
      tokenAttributes.value = undefined;
      return;
    }
    await updateTokenAttributes(chain.value, token.value);
  }

  watch([token, chain], handleParamChange, { immediate: true });

  return { transferLimitTokenAmount, formattedMinFee };
}
