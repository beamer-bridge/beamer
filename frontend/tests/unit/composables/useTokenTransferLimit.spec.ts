import { flushPromises } from '@vue/test-utils';
import { ref } from 'vue';

import { useTokenTransferLimit } from '@/composables/useTokenTransferLimit';
import * as requestManagerService from '@/services/transactions/request-manager';
import { UInt256 } from '@/types/uint-256';
import { generateChain, generateToken } from '~/utils/data_generators';

vi.mock('@/services/transactions/request-manager');
const CHAIN = ref(generateChain());
const TOKEN = ref(generateToken());

describe('useTokenTransferLimit', () => {
  beforeEach(() => {
    global.console.error = vi.fn();
  });
  describe('transferLimitTokenAmount', () => {
    it('is set to undefined when provided token is undefined', async () => {
      const token = ref(undefined);
      const { transferLimitTokenAmount } = useTokenTransferLimit(CHAIN, token);

      await flushPromises();
      expect(transferLimitTokenAmount.value).toBeUndefined();
    });

    it('is set to undefined when provided chain is undefined', async () => {
      const chain = ref(undefined);
      const { transferLimitTokenAmount } = useTokenTransferLimit(chain, TOKEN);

      await flushPromises();
      expect(transferLimitTokenAmount.value).toBeUndefined();
    });

    describe('when all the arguments are defined', () => {
      it('holds the transfer limit in token amount', async () => {
        const token = ref(generateToken({ decimals: 8 }));

        Object.defineProperty(requestManagerService, 'getTokenTransferLimit', {
          value: vi.fn().mockResolvedValue(new UInt256('10000000')),
        });

        const { transferLimitTokenAmount } = useTokenTransferLimit(CHAIN, token);
        await flushPromises();

        expect(transferLimitTokenAmount.value?.decimalAmount).toBe('0.1');
      });

      it('holds an undefined value when an exception occured', async () => {
        Object.defineProperty(requestManagerService, 'getTokenTransferLimit', {
          value: vi.fn().mockImplementation(() => {
            throw new Error('error');
          }),
        });

        const { transferLimitTokenAmount } = useTokenTransferLimit(CHAIN, TOKEN);
        await flushPromises();

        expect(transferLimitTokenAmount.value).toBe(undefined);
      });
    });
  });
});
