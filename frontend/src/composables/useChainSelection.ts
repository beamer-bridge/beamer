import type { Ref } from 'vue';
import { computed } from 'vue';

import type { ChainConfigMapping } from '@/types/config';
import type { Chain } from '@/types/data';
import type { SelectorOption } from '@/types/form';
import { removeMatchesByProperty } from '@/utils/arrayFilters';

export function useChainSelection(chains: Ref<ChainConfigMapping>, ignoreChains: Ref<Chain[]>) {
  const chainOptions = computed(() => {
    return removeMatchesByProperty<Chain>(
      Object.values(chains.value),
      ignoreChains.value,
      'identifier',
    )
      .map((chain) => getChainSelectorOption(chain.identifier, chains.value))
      .filter((chain) => !chain?.value.hidden);
  });

  return { chainOptions };
}

export function getChainSelectorOption(
  chainId: number,
  chains: ChainConfigMapping,
): SelectorOption<Chain> | null {
  if (chains[chainId]) {
    const chain: Chain = {
      identifier: Number(chainId),
      name: chains[chainId].name,
      rpcUrl: chains[chainId].rpcUrl,
      requestManagerAddress: chains[chainId].requestManagerAddress,
      fillManagerAddress: chains[chainId].fillManagerAddress,
      explorerUrl: chains[chainId].explorerUrl,
      imageUrl: chains[chainId].imageUrl,
      nativeCurrency: chains[chainId].nativeCurrency,
      internalRpcUrl: chains[chainId].internalRpcUrl,
      feeSubAddress: chains[chainId].feeSubAddress,
      disabled: chains[chainId].disabled,
      disabled_reason: chains[chainId].disabled_reason,
      hidden: chains[chainId].hidden,
    };
    return {
      value: chain,
      label: chain.name,
      imageUrl: chain.imageUrl,
      disabled: chains[chainId].disabled,
      disabled_reason: chains[chainId].disabled_reason,
    };
  }
  return null;
}
