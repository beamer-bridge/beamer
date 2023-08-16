import type { Ref } from 'vue';
import { computed, ref, watch } from 'vue';

import { type IEthereumProvider, createEthereumProvider } from '@/services/web3-provider';
import type { Chain, Token } from '@/types/data';
import type { TokenAmount } from '@/types/token-amount';
import { AGENT_ADDRESSES } from '@/utils/agentAddresses';

import { useTokenBalance } from './useTokenBalance';

export function useMaxFillableAmount(
  targetChain: Ref<Chain | undefined>,
  token: Ref<Token | undefined>,
) {
  const provider: Ref<IEthereumProvider | undefined> = ref(undefined);
  watch(
    targetChain,
    async (chain) =>
      (provider.value = chain ? await createEthereumProvider(chain.internalRpcUrl) : undefined),
  );

  const balances: Ref<TokenAmount | undefined>[] = [];
  for (const agent of AGENT_ADDRESSES) {
    const { balance } = useTokenBalance(provider, ref(agent), token);
    balances.push(balance);
  }

  const maxFillableAmount = computed(() => {
    let maxAmount: TokenAmount | undefined;
    for (const balance of balances) {
      if (!maxAmount) {
        maxAmount = balance.value;
        continue;
      }
      if (balance.value && maxAmount.uint256.lt(balance.value.uint256)) {
        maxAmount = balance.value;
      }
    }
    return maxAmount;
  });

  return { amount: maxFillableAmount };
}
