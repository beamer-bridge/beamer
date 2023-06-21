import { ref } from 'vue';

import { getChainSelectorOption, useChainSelection } from '@/composables/useChainSelection';
import type { Chain } from '@/types/data';
import type { SelectorOption } from '@/types/form';
import { generateChainWithTokens } from '~/utils/data_generators';

describe('useChainSelection', () => {
  describe('chainOptions', () => {
    it('holds a set of chain selector options based on provided set of chains', () => {
      const chainOne = generateChainWithTokens({ identifier: 1 });
      const chainTwo = generateChainWithTokens({ identifier: 2 });

      const chains = ref({
        [chainOne.identifier]: chainOne,
        [chainTwo.identifier]: chainTwo,
      });

      const { chainOptions } = useChainSelection(chains, ref([]));

      expect(chainOptions.value).toHaveLength(2);
      expect(chainOptions.value).toEqual([
        getChainSelectorOption(chainOne.identifier, chains.value),
        getChainSelectorOption(chainTwo.identifier, chains.value),
      ]);
    });

    it('holds a filtered set of chain selector options when provided a set of chains to ignore', () => {
      const chainOne = generateChainWithTokens({ identifier: 1 });
      const chainTwo = generateChainWithTokens({ identifier: 2 });

      const chains = ref({
        [chainOne.identifier]: chainOne,
        [chainTwo.identifier]: chainTwo,
      });

      const chainsToIgnore = ref([chainOne]);

      const { chainOptions } = useChainSelection(chains, chainsToIgnore);

      expect(chainOptions.value).toHaveLength(1);
      expect(chainOptions.value).toEqual([
        getChainSelectorOption(chainTwo.identifier, chains.value),
      ]);
    });

    it('holds a set of chain selector options that exclude options defined as hidden', () => {
      const chainOne = generateChainWithTokens({ identifier: 1 });
      const chainTwo = generateChainWithTokens({ identifier: 2, hidden: true });

      const chains = ref({
        [chainOne.identifier]: chainOne,
        [chainTwo.identifier]: chainTwo,
      });

      const { chainOptions } = useChainSelection(chains, ref([]));

      expect(chainOptions.value).toHaveLength(1);
      expect(chainOptions.value).toEqual([
        getChainSelectorOption(chainOne.identifier, chains.value),
      ]);
    });
  });
});

describe('getChainSelectorOption', () => {
  it('returns a normalized representation of a chain found which can be used as a selector option', () => {
    const chain = generateChainWithTokens();
    const chainId = chain.identifier;
    const chains = {
      [chainId]: chain,
    };

    const chainSelectorOption = getChainSelectorOption(chainId, chains) as SelectorOption<Chain>;

    expect(Object.keys(chainSelectorOption)).toEqual([
      'value',
      'label',
      'imageUrl',
      'disabled',
      'disabled_reason',
      'hidden',
    ]);
  });
  it('returns null if chain is not found in provided set of chains', () => {
    const chain = generateChainWithTokens({ identifier: 1 });
    const chainId = 2;
    const chains = {
      [chain.identifier]: chain,
    };

    const chainSelectorOption = getChainSelectorOption(chainId, chains);

    expect(chainSelectorOption).toBe(null);
  });
});
