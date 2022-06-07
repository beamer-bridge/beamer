import type { Ref } from 'vue';
import { computed, ref } from 'vue';

import type { IEthereumProvider } from '@/services/web3-provider';
import type { ChainConfigMapping } from '@/types/config';
import type { Chain } from '@/types/data';
import type { SelectorOption } from '@/types/form';

export function useChainSelection(
  provider: Ref<IEthereumProvider | undefined>,
  chains: Ref<ChainConfigMapping>,
) {
  const _selectedSourceChain = ref<SelectorOption<Chain> | null>(null);
  const selectedSourceChain = computed({
    get() {
      return (
        _selectedSourceChain.value ??
        getChainSelectorOption(String(provider.value?.chainId.value), chains.value)
      );
    },
    set(chain: SelectorOption<Chain> | null) {
      _selectedSourceChain.value = chain;
    },
  });

  const sourceChains = computed(() =>
    Object.keys(chains.value).map((chainId) => getChainSelectorOption(chainId, chains.value)),
  );
  const targetChains = computed(() =>
    sourceChains.value.filter(
      (chain) =>
        chain?.value.identifier !== selectedSourceChain.value?.value.identifier ||
        process.env.NODE_ENV === 'development',
    ),
  );

  const switchChain = async (chain: Ref<Chain>) => {
    if (provider.value && chain.value.identifier !== provider.value.chainId.value) {
      try {
        const isSuccessfulSwitch = await provider.value.switchChain(chain.value.identifier);
        if (isSuccessfulSwitch === null) {
          await provider.value.addChain({
            chainId: chain.value.identifier,
            name: chain.value.name,
            rpcUrl: chain.value.rpcUrl,
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
): SelectorOption<Chain> | null {
  if (chains[chainId]) {
    const chain: Chain = {
      identifier: Number(chainId),
      name: chains[chainId].name,
      rpcUrl: chains[chainId].rpcUrl,
      requestManagerAddress: chains[chainId].requestManagerAddress,
      fillManagerAddress: chains[chainId].fillManagerAddress,
      explorerTransactionUrl: chains[chainId].explorerTransactionUrl,
    };
    return { value: chain, label: chain.name };
  }
  return null;
}
