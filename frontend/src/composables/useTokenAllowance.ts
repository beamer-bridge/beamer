import type { Ref } from 'vue';
import { computed, ref, watch } from 'vue';

import { getTokenAllowance } from '@/services/transactions/token';
import type { IEthereumProvider } from '@/services/web3-provider';
import type { Chain, Token } from '@/types/data';
import type { TokenAmount } from '@/types/token-amount';
import { UInt256 } from '@/types/uint-256';

export function useTokenAllowance(
  provider: Ref<IEthereumProvider | undefined>,
  token: Ref<Token | undefined>,
  sourceChain: Ref<Chain | undefined>,
) {
  const signerAddress = computed(() => provider.value?.signerAddress.value);
  const allowance: Ref<TokenAmount | undefined> = ref(undefined);

  const allowanceBelowMax = computed(() => allowance.value?.uint256.lt(UInt256.max()) ?? false);

  async function updateTokenAllowance() {
    if (token.value && provider.value && sourceChain.value && signerAddress.value) {
      allowance.value = await getTokenAllowance(
        provider.value,
        token.value,
        signerAddress.value,
        sourceChain.value.feeSubAddress || sourceChain.value.requestManagerAddress,
      );
    } else {
      allowance.value = undefined;
    }
  }

  watch([token, sourceChain, signerAddress], updateTokenAllowance, { immediate: true });

  return { allowance, allowanceBelowMax };
}
