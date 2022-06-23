import type { Ref } from 'vue';
import { computed, ref } from 'vue';

import type { IEthereumProvider } from '@/services/web3-provider';
import type { ChainConfigMapping } from '@/types/config';
import type { Token } from '@/types/data';
import type { SelectorOption } from '@/types/form';

export function useTokenSelection(
  chains: Ref<ChainConfigMapping>,
  connectedChainIdentifier: Ref<number | undefined>,
  provider: Ref<IEthereumProvider | undefined>,
) {
  const tokens = computed(
    () =>
      chains.value[connectedChainIdentifier.value ?? -1]?.tokens.map((token) =>
        getTokenSelectorOption(token),
      ) ?? [],
  );

  const _selectedToken = ref<SelectorOption<Token> | null>(null);
  const selectedToken = computed({
    get() {
      return _selectedToken.value;
    },
    set(token: SelectorOption<Token> | null) {
      _selectedToken.value = token;
    },
  });
  const selectedTokenAddress = computed(() => selectedToken.value?.value.address);

  const addTokenToProvider = async () => {
    if (!provider.value || !selectedToken.value) {
      throw new Error('Provider or token missing!');
    }
    try {
      await provider.value.addToken(selectedToken.value.value);
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

function getTokenSelectorOption(token: Token): SelectorOption<Token> {
  return {
    value: token,
    label: token.symbol,
  };
}
