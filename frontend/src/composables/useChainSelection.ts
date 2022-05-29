import type { Ref } from 'vue';
import { computed, ref } from 'vue';

import type { EthereumProvider } from '@/services/web3-provider';
import type { ChainConfigMapping } from '@/types/config';
import type { SelectorOption } from '@/types/form';

export function useChainSelection(
  provider: Ref<EthereumProvider | undefined>,
  chains: Ref<ChainConfigMapping>,
) {
  const _selectedSourceChain = ref<SelectorOption<number> | null>(null);
  const selectedSourceChain = computed({
    get() {
      return (
        _selectedSourceChain.value ??
        getChainSelectorOption(String(provider.value?.chainId.value), chains.value)
      );
    },
    set(chain: SelectorOption<number> | null) {
      _selectedSourceChain.value = chain;
    },
  });

  const sourceChains = computed(() =>
    Object.keys(chains.value).map((chainId) => getChainSelectorOption(chainId, chains.value)),
  );
  const targetChains = computed(() =>
    sourceChains.value.filter((chain) => chain?.value !== selectedSourceChain.value?.value),
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

  return { selectedSourceChain, sourceChains, targetChains, switchChain };
}

function getChainSelectorOption(
  chainId: string,
  chains: ChainConfigMapping,
): SelectorOption<number> | null {
  return chains[chainId]
    ? {
        value: Number(chainId),
        label: chains[chainId]?.name,
      }
    : null;
}
