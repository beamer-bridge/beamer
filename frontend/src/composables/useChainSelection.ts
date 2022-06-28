import type { Ref } from 'vue';
import { computed } from 'vue';

import type { IEthereumProvider } from '@/services/web3-provider';
import type { ChainConfigMapping } from '@/types/config';
import type { Chain } from '@/types/data';
import type { SelectorOption } from '@/types/form';

export function useChainSelection(
  provider: Ref<IEthereumProvider | undefined>,
  chains: Ref<ChainConfigMapping>,
  ignoreChains: Ref<Chain[]>,
) {
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

  return { chainOptions, switchChain };
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
    };
    return { value: chain, label: chain.name };
  }
  return null;
}
