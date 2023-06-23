import type { Ref } from 'vue';
import { computed } from 'vue';

import type { Token } from '@/types/data';
import type { SelectorOption } from '@/types/form';

export function useTokenSelection(tokens: Ref<Token[]>) {
  const tokenOptions = computed(() =>
    tokens.value
      .map(getTokenSelectorOption)
      .filter((tokenSelectionOption) => !tokenSelectionOption.value.hidden),
  );

  return {
    tokenOptions,
  };
}

function getTokenSelectorOption(token: Token): SelectorOption<Token> {
  return {
    value: token,
    label: token.symbol,
    imageUrl: token.imageUrl,
  };
}
