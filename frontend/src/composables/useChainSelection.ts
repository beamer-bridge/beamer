import type { Ref } from 'vue';
import { computed } from 'vue';

import type { ChainConfigMapping } from '@/types/config';
import type { Chain } from '@/types/data';
import type { SelectorOption } from '@/types/form';

export function useChainSelection(chains: Ref<ChainConfigMapping>, ignoreChains: Ref<Chain[]>) {
  const chainOptions = computed(() => {
    const options = Object.keys(chains.value)
      .map((chainId) => getChainSelectorOption(chainId, chains.value))
      .filter((chainOption) => chainOption !== null) as SelectorOption<Chain>[];
    return options.filter(
      (chainOption) =>
        !ignoreChains.value.find(
          (ignoreChain) => ignoreChain.identifier === chainOption.value.identifier,
        ),
    );
  });

  return { chainOptions };
}

export function getChainSelectorOption(
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
      imageUrl: chains[chainId].imageUrl,
    };
    return { value: chain, label: chain.name, imageUrl: chain.imageUrl };
  }
  return null;
}
