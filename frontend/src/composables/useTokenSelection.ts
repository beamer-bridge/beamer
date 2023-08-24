import type { Ref } from 'vue';
import { computed } from 'vue';

import type { Token } from '@/types/data';
import type { SelectorOption } from '@/types/form';
import { findMatchesByProperty } from '@/utils/arrayFilters';

export function useTokenSelection(tokens: Ref<Token[]>, intersectWithTokens?: Ref<Token[]>) {
  const tokenOptions = computed(() => {
    let options = tokens.value;

    if (intersectWithTokens?.value.length) {
      options = findMatchesByProperty<Token>(
        Object.values(tokens.value),
        intersectWithTokens.value,
        'symbol',
      );
    }

    return options
      .map(getTokenSelectorOption)
      .filter((tokenSelectionOption) => !tokenSelectionOption.value.hidden);
  });

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
