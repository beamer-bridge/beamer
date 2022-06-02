import type { Ref } from 'vue';
import { computed, ref } from 'vue';

import { getTokenDecimals } from '@/services/transactions/token';
import type { EthereumProvider } from '@/services/web3-provider';
import type { ChainConfigMapping } from '@/types/config';
import type { Token } from '@/types/data';
import type { SelectorOption } from '@/types/form';

export function useTokenSelection(
  provider: Ref<EthereumProvider | undefined>,
  chains: Ref<ChainConfigMapping>,
) {
  const tokens = computed(() =>
    chains.value[String(provider.value?.chainId.value)]?.tokens.map((token) =>
      getTokenSelectorOption(token),
    ),
  );

  const _selectedToken = ref<SelectorOption<string> | null>(null);
  const selectedToken = computed({
    get() {
      return _selectedToken.value;
    },
    set(token: SelectorOption<string> | null) {
      _selectedToken.value = token;
    },
  });
  const selectedTokenAddress = computed(() => selectedToken.value?.value);

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
