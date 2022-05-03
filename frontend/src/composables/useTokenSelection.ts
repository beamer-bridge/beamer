import { computed, Ref, ref } from 'vue';

import { getTokenDecimals } from '@/services/transactions/token';
import type { EthereumProvider } from '@/services/web3-provider';
import { ChainConfigMapping, Token } from '@/types/config';
import { SelectorOption } from '@/types/form';

export function useTokenSelection(
  provider: Ref<EthereumProvider | undefined>,
  chains: Ref<ChainConfigMapping>,
) {
  const tokens = computed(() =>
    chains.value[String(provider.value?.chainId.value)]?.tokens.map((token) =>
      getTokenSelectorOption(token),
    ),
  );

  const selectedToken: Ref<SelectorOption<string> | undefined> = ref();
  const selectedTokenAddress = computed(() => selectedToken.value?.value);

  const switchToken = (token: SelectorOption<string>) => {
    selectedToken.value = token;
  };

  const addTokenToProvider = async () => {
    if (!provider.value || !selectedToken.value) {
      throw new Error('Provider or token missing!');
    }
    try {
      const decimals = await getTokenDecimals(provider.value, selectedToken.value.value);

      await provider.value.addToken({
        address: selectedToken.value.value,
        symbol: selectedToken.value.label,
        decimals: Number(decimals),
      });
    } catch (error) {
      console.error(error);
    }
  };

  const addTokenAvailable = computed(() => provider.value && selectedToken.value);

  return {
    selectedToken,
    selectedTokenAddress,
    tokens,
    switchToken,
    addTokenToProvider,
    addTokenAvailable,
  };
}

function getTokenSelectorOption(token: Token): SelectorOption<string> {
  return {
    value: token.address,
    label: token.symbol,
  };
}
