import { ref } from 'vue';

import { useTokenSelection } from '@/composables/useTokenSelection';
import { generateToken } from '~/utils/data_generators';

describe('useTokenSelection', () => {
  it('returns a list of token selector options based on provided token list', () => {
    const tokenOne = generateToken();
    const tokenTwo = generateToken();
    const tokens = ref([tokenOne, tokenTwo]);

    const { tokenOptions } = useTokenSelection(tokens);

    expect(tokenOptions.value).toHaveLength(2);
    expect(tokenOptions.value[0].value).toEqual(tokenOne);
    expect(tokenOptions.value[1].value).toEqual(tokenTwo);
  });
});
