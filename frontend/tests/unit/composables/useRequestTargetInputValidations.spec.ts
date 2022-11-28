import type { Ref } from 'vue';
import { ref } from 'vue';

import { useRequestTargetInputValidations } from '@/composables/useRequestTargetInputValidations';
import type { Chain } from '@/types/data';
import type { SelectorOption } from '@/types/form';
import * as addressBlacklistUtils from '@/utils/addressBlacklist';
import { generateChainSelectorOption } from '~/utils/data_generators';

vi.mock('@/utils/addressBlacklist');

function createConfig(options?: {
  selectedTargetChain?: Ref<SelectorOption<Chain> | null>;
  selectedTargetAddress?: Ref<string>;
  sourceChain?: Ref<SelectorOption<Chain> | null>;
}) {
  return {
    selectedTargetChain: options?.selectedTargetChain ?? ref(null),
    selectedTargetAddress: options?.selectedTargetAddress ?? ref(''),
    sourceChain: options?.sourceChain ?? ref(null),
  };
}

describe('useRequestTargetInputValidations', () => {
  it('returns a computed property that holds the validity state of the request target form', () => {
    const v$ = useRequestTargetInputValidations(createConfig());
    expect(v$.value.$invalid).toBeDefined();
  });

  describe('selectedTargetAddress', () => {
    it('is valid when its value is a valid non-blacklisted ETH address', () => {
      Object.defineProperty(addressBlacklistUtils, 'isAddressBlacklisted', {
        value: vi.fn().mockReturnValue(false),
      });
      const selectedTargetAddress = ref('0x0b789C16c313164DD27B8b751D8e7320c838BC47');

      const v$ = useRequestTargetInputValidations(createConfig({ selectedTargetAddress }));
      expect(v$.value.selectedTargetAddress.$invalid).toBe(false);
    });

    it('is invalid when its value is not defined', () => {
      const v$ = useRequestTargetInputValidations(createConfig());
      expect(v$.value.selectedTargetAddress.$invalid).toBe(true);

      const errorMessage = v$.value.selectedTargetAddress.$silentErrors[0].$message;
      expect(errorMessage).toEqual('Target address is required');
    });

    it('is invalid when its value is not a valid ETH address', () => {
      const selectedTargetAddress = ref('0x123');

      const v$ = useRequestTargetInputValidations(createConfig({ selectedTargetAddress }));
      expect(v$.value.selectedTargetAddress.$invalid).toBe(true);

      const errorMessage = v$.value.selectedTargetAddress.$silentErrors[0].$message;
      expect(errorMessage).toEqual('Invalid ETH address');
    });

    it('is invalid if its value is found on the blacklist', () => {
      Object.defineProperty(addressBlacklistUtils, 'isAddressBlacklisted', {
        value: vi.fn().mockReturnValue(true),
      });
      // TODO: switch to `getRandomEthereumAddress` function once it is fixed to return correct checksum addresses
      const selectedTargetAddress = ref('0x0b789C16c313164DD27B8b751D8e7320c838BC47');
      const v$ = useRequestTargetInputValidations(createConfig({ selectedTargetAddress }));
      expect(v$.value.selectedTargetAddress.$invalid).toBe(true);

      const errorMessage = v$.value.selectedTargetAddress.$silentErrors[0].$message;
      expect(errorMessage).toEqual('Blacklisted ETH address');
    });
  });

  describe('selectedTargetChain', () => {
    it('is valid when its value is defined', () => {
      const selectedTargetChain = ref(generateChainSelectorOption());

      const v$ = useRequestTargetInputValidations(createConfig({ selectedTargetChain }));
      expect(v$.value.selectedTargetChain.$invalid).toBe(false);
    });

    it('is invalid when its value is not defined', () => {
      const v$ = useRequestTargetInputValidations(createConfig());
      expect(v$.value.selectedTargetChain.$invalid).toBe(true);

      const errorMessage = v$.value.selectedTargetChain.$silentErrors[0].$message;
      expect(errorMessage).toEqual('Value is required');
    });

    it('is invalid when its value is same as source chain selection value', async () => {
      const chain = generateChainSelectorOption();

      const v$ = useRequestTargetInputValidations(
        createConfig({ selectedTargetChain: ref(chain), sourceChain: ref(chain) }),
      );
      expect(v$.value.selectedTargetAddress.$invalid).toBe(true);
    });
  });
});
