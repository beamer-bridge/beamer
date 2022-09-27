import { flushPromises } from '@vue/test-utils';
import { ref } from 'vue';

import { useMinRequestFee } from '@/composables/useMinRequestFee';
import * as requestManagerService from '@/services/transactions/request-manager';
import { UInt256 } from '@/types/uint-256';
import { generateChain, generateToken } from '~/utils/data_generators';

vi.mock('@/services/transactions/request-manager');

describe('useMinRequestFee', () => {
  describe('formattedMinFee', () => {
    it('is set to undefined when provided token is undefined', async () => {
      const chain = ref(generateChain());
      const token = ref(undefined);
      const { formattedMinFee } = useMinRequestFee(chain, token);

      await flushPromises();
      expect(formattedMinFee.value).toBeUndefined();
    });

    it('is set to undefined when provided chain is undefined', async () => {
      const chain = ref(undefined);
      const token = ref(generateToken());
      const { formattedMinFee } = useMinRequestFee(chain, token);

      await flushPromises();
      expect(formattedMinFee.value).toBeUndefined();
    });

    it('holds the minimum fees represented in token amount', async () => {
      const chain = ref(generateChain());
      const token = ref(generateToken({ decimals: 8 }));
      Object.defineProperty(requestManagerService, 'getMinRequestFee', {
        value: vi.fn().mockResolvedValue(new UInt256('10000000')),
      });

      const { formattedMinFee } = useMinRequestFee(chain, token);
      await flushPromises();

      expect(formattedMinFee.value).toEqual('0.1 ' + token.value.symbol);
    });
    it('updates on token change', async () => {
      const chain = ref(generateChain());
      const token = ref(generateToken({ decimals: 8 }));
      const mockFn = vi.fn().mockResolvedValue(new UInt256('10000000'));

      Object.defineProperty(requestManagerService, 'getMinRequestFee', {
        value: mockFn,
      });

      const { formattedMinFee } = useMinRequestFee(chain, token);
      await flushPromises();

      expect(formattedMinFee.value).toEqual('0.1 ' + token.value.symbol);
    });
  });

  describe('minFee', () => {
    it('is set to undefined when provided chain is undefined', () => {
      const chain = ref(undefined);
      const token = ref(generateToken());
      const { minFee } = useMinRequestFee(chain, token);

      expect(minFee.value).toBeUndefined();
    });

    it('holds the minimum fee number when a chain is provided', async () => {
      const chain = ref(generateChain());
      const token = ref(undefined);
      const mockedMinFees = new UInt256('100');
      Object.defineProperty(requestManagerService, 'getMinRequestFee', {
        value: vi.fn().mockResolvedValue(mockedMinFees),
      });

      const { minFee } = useMinRequestFee(chain, token);
      await flushPromises();

      expect(minFee.value).toEqual(mockedMinFees);
    });

    it('refetches on chain change', async () => {
      const chain = ref(generateChain());
      const token = ref(undefined);
      const mockFn = vi.fn();
      Object.defineProperty(requestManagerService, 'getMinRequestFee', {
        value: mockFn,
      });

      useMinRequestFee(chain, token);
      await flushPromises();

      expect(mockFn).toHaveBeenCalledTimes(1);

      chain.value = generateChain();
      await flushPromises();
      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });
});
