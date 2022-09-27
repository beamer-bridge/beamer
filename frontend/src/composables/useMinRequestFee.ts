import type { Ref } from 'vue';
import { computed, ref, watch } from 'vue';

import { getMinRequestFee } from '@/services/transactions/request-manager';
import type { Chain, Token } from '@/types/data';
import { TokenAmount } from '@/types/token-amount';
import type { UInt256 } from '@/types/uint-256';

export const useMinRequestFee = (chain: Ref<Chain | undefined>, token: Ref<Token | undefined>) => {
  const minFee = ref<UInt256>();

  const formattedMinFee = computed(() => {
    if (!minFee.value || !token.value) {
      return undefined;
    }

    const feesInToken = TokenAmount.new(minFee.value, token.value);
    return feesInToken.formatFullValue();
  });

  const getMinFee = async () => {
    if (!chain.value) {
      return;
    }

    minFee.value = await getMinRequestFee(chain.value.rpcUrl, chain.value.requestManagerAddress);
  };

  watch(chain, getMinFee, { immediate: true });

  return { minFee, formattedMinFee };
};
