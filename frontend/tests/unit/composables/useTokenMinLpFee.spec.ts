import { flushPromises } from '@vue/test-utils';
import { ref } from 'vue';

import { useTokenMinLpFee } from '@/composables/useTokenMinLpFee';
import * as requestManagerService from '@/services/transactions/request-manager';
import { UInt256 } from '@/types/uint-256';
import { generateChain, generateToken } from '~/utils/data_generators';

vi.mock('@/services/transactions/request-manager');

const SOURCE_CHAIN_REF = ref(generateChain({ identifier: 1 }));
const TARGET_CHAIN_REF = ref(generateChain({ identifier: 2 }));
const TOKEN = ref(generateToken());

describe('useTokenMinLpFee', () => {
  beforeEach(() => {
    global.console.error = vi.fn();
  });
  describe('formattedMinFee', () => {
    it('is set to undefined when provided token is undefined', async () => {
      const token = ref(undefined);
      const { formattedMinFee } = useTokenMinLpFee(SOURCE_CHAIN_REF, TARGET_CHAIN_REF, token);

      await flushPromises();
      expect(formattedMinFee.value).toBeUndefined();
    });

    it('is set to undefined when provided source chain is undefined', async () => {
      const sourceChain = ref(undefined);
      const { formattedMinFee } = useTokenMinLpFee(sourceChain, TARGET_CHAIN_REF, TOKEN);

      await flushPromises();
      expect(formattedMinFee.value).toBeUndefined();
    });

    it('is set to undefined when provided target chain is undefined', async () => {
      const targetChain = ref(undefined);
      const { formattedMinFee } = useTokenMinLpFee(SOURCE_CHAIN_REF, targetChain, TOKEN);

      await flushPromises();
      expect(formattedMinFee.value).toBeUndefined();
    });

    describe('when all the arguments are defined', () => {
      it('holds the transfer limit in token amount', async () => {
        const token = ref(generateToken({ decimals: 8 }));

        Object.defineProperty(requestManagerService, 'getTokenMinLpFee', {
          value: vi.fn().mockResolvedValue(new UInt256('10000000')),
        });

        const { formattedMinFee } = useTokenMinLpFee(SOURCE_CHAIN_REF, TARGET_CHAIN_REF, token);
        await flushPromises();

        expect(formattedMinFee.value).toBe(`0.1 ${token.value.symbol}`);
      });

      it('holds an undefined value when an exception occured', async () => {
        Object.defineProperty(requestManagerService, 'getTokenMinLpFee', {
          value: vi.fn().mockImplementation(() => {
            throw new Error('error');
          }),
        });

        const { formattedMinFee } = useTokenMinLpFee(SOURCE_CHAIN_REF, TARGET_CHAIN_REF, TOKEN);
        await flushPromises();

        expect(formattedMinFee.value).toBe(undefined);
      });
    });
  });
});
