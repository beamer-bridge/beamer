import { flushPromises } from '@vue/test-utils';
import { ref } from 'vue';

import { useTokenAttributes } from '@/composables/useTokenAttributes';
import * as requestManagerService from '@/services/transactions/request-manager';
import { UInt256 } from '@/types/uint-256';
import { generateChain, generateToken } from '~/utils/data_generators';

vi.mock('@/services/transactions/request-manager');

describe('useTokenAttributes', () => {
  beforeEach(() => {
    global.console.error = vi.fn();
  });
  describe('transferLimitTokenAmount', () => {
    it('is set to undefined when provided token is undefined', async () => {
      const chain = ref(generateChain());
      const token = ref(undefined);
      const { transferLimitTokenAmount } = useTokenAttributes(chain, token);

      await flushPromises();
      expect(transferLimitTokenAmount.value).toBeUndefined();
    });

    it('is set to undefined when provided chain is undefined', async () => {
      const chain = ref(undefined);
      const token = ref(generateToken());
      const { transferLimitTokenAmount } = useTokenAttributes(chain, token);

      await flushPromises();
      expect(transferLimitTokenAmount.value).toBeUndefined();
    });

    describe('when all the arguments are defined', () => {
      it('holds the transfer limit in token amount', async () => {
        const chain = ref(generateChain());
        const token = ref(generateToken({ decimals: 8 }));

        Object.defineProperty(requestManagerService, 'getTokenAttributes', {
          value: vi.fn().mockResolvedValue({
            transferLimit: new UInt256('10000000'),
          }),
        });

        const { transferLimitTokenAmount } = useTokenAttributes(chain, token);
        await flushPromises();

        expect(transferLimitTokenAmount.value?.decimalAmount).toBe('0.1');
      });

      it('holds an undefined value when an exception occured', async () => {
        const chain = ref(generateChain());
        const token = ref(generateToken({ decimals: 8 }));

        Object.defineProperty(requestManagerService, 'getTokenAttributes', {
          value: vi.fn().mockImplementation(() => {
            throw new Error('error');
          }),
        });

        const { transferLimitTokenAmount } = useTokenAttributes(chain, token);
        await flushPromises();

        expect(transferLimitTokenAmount.value).toBe(undefined);
      });
    });
  });

  describe('formattedMinFee', () => {
    it('is set to undefined when provided token is undefined', async () => {
      const chain = ref(generateChain());
      const token = ref(undefined);
      const { formattedMinFee } = useTokenAttributes(chain, token);

      await flushPromises();
      expect(formattedMinFee.value).toBeUndefined();
    });

    it('is set to undefined when provided chain is undefined', async () => {
      const chain = ref(undefined);
      const token = ref(generateToken());
      const { formattedMinFee } = useTokenAttributes(chain, token);

      await flushPromises();
      expect(formattedMinFee.value).toBeUndefined();
    });

    it('holds the minimum fees represented in token amount', async () => {
      const chain = ref(generateChain());
      const token = ref(generateToken({ decimals: 8 }));

      Object.defineProperty(requestManagerService, 'getTokenAttributes', {
        value: vi.fn().mockResolvedValue({
          minLpFee: new UInt256('10000000'),
        }),
      });

      const { formattedMinFee } = useTokenAttributes(chain, token);
      await flushPromises();

      expect(formattedMinFee.value).toEqual('0.1 ' + token.value.symbol);
    });
    it('updates on token change', async () => {
      const chain = ref(generateChain());
      const token = ref(generateToken({ decimals: 8 }));

      const mockedReturn = {
        minLpFee: new UInt256('10000000'),
      };

      Object.defineProperty(requestManagerService, 'getTokenAttributes', {
        value: vi.fn().mockResolvedValue(mockedReturn),
      });

      const { formattedMinFee } = useTokenAttributes(chain, token);
      await flushPromises();

      expect(formattedMinFee.value).toEqual('0.1 ' + token.value.symbol);

      token.value = generateToken({ decimals: 9 });
      expect(formattedMinFee.value).toEqual('0.01 ' + token.value.symbol);
    });
  });
});
