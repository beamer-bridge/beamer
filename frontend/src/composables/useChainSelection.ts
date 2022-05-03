import { computed, Ref, ref } from 'vue';

import type { EthereumProvider } from '@/services/web3-provider';
import { ChainConfigMapping } from '@/types/config';
import { SelectorOption } from '@/types/form';

export function useChainSelection(
  provider: Ref<EthereumProvider | undefined>,
  chains: Ref<ChainConfigMapping>,
) {
  const sourceChainId = ref(
    getChainSelectorOption(String(provider.value?.chainId.value), chains.value),
  );
  const sourceChains = computed(() =>
    Object.keys(chains.value).map((chainId) => getChainSelectorOption(chainId, chains.value)),
  );
  const targetChains = computed(() =>
    sourceChains.value.filter((chain) => chain?.value !== sourceChainId.value?.value),
  );

  const switchChain = async (chainId: Ref<number>) => {
    if (provider.value && chainId.value !== provider.value.chainId.value) {
      try {
        const isSuccessfulSwitch = await provider.value.switchChain(chainId.value);
        if (isSuccessfulSwitch === null) {
          await provider.value.addChain({
            chainId: chainId.value,
            name: chains.value[chainId.value].name,
            rpcUrl: chains.value[chainId.value].rpcUrl,
          });
        }
      } catch (error) {
        location.reload();
      }
    }
  };

  return { sourceChainId, sourceChains, targetChains, switchChain };
}

function getChainSelectorOption(
  chainId: string,
  chains: ChainConfigMapping,
): SelectorOption<number> | undefined {
  return chains[chainId]
    ? {
        value: Number(chainId),
        label: chains[chainId]?.name,
      }
    : undefined;
}
