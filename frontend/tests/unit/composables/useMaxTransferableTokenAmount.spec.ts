import { flushPromises } from '@vue/test-utils';
import type { Ref } from 'vue';
import { ref } from 'vue';

import { useMaxTransferableTokenAmount } from '@/composables/useMaxTransferableTokenAmount';
import * as requestManagerService from '@/services/transactions/request-manager';
import { TokenAmount } from '@/types/token-amount';
import { UInt256 } from '@/types/uint-256';
import { generateChain, generateToken } from '~/utils/data_generators';

const TOKEN = generateToken();
const CHAIN = generateChain();

vi.mock('@/services/transactions/request-manager');

describe('useMaxTransferableTokenAmount', () => {
  beforeEach(() => {
    global.console.error = vi.fn();
  });

  describe('maxTransferableTokenAmount', () => {
    it('is undefined when provided total amount is undefined', async () => {
      const totalAmount = ref(undefined);
      const chain = ref(CHAIN);

      const { maxTransferableTokenAmount } = useMaxTransferableTokenAmount(totalAmount, chain);
      await flushPromises();

      expect(maxTransferableTokenAmount.value).toBeUndefined();
    });

    it('is undefined when provided chain is undefined', async () => {
      const totalAmount = ref(
        new TokenAmount({ amount: '1000', token: TOKEN }),
      ) as Ref<TokenAmount>;
      const chain = ref(undefined);

      const { maxTransferableTokenAmount } = useMaxTransferableTokenAmount(totalAmount, chain);
      await flushPromises();

      expect(maxTransferableTokenAmount.value).toBeUndefined();
    });

    it('holds the actual transferable amount derived from the provided total amount by deducting the expected fees', async () => {
      const totalAmount = ref(
        new TokenAmount({ amount: '1000', token: TOKEN }),
      ) as Ref<TokenAmount>;

      const chain = ref(CHAIN);

      const mockedAmountBeforeFees = totalAmount.value.uint256.subtract(new UInt256('100'));
      Object.defineProperty(requestManagerService, 'getAmountBeforeFees', {
        value: vi.fn().mockReturnValue(mockedAmountBeforeFees),
      });

      const { maxTransferableTokenAmount } = useMaxTransferableTokenAmount(totalAmount, chain);
      await flushPromises();

      expect(maxTransferableTokenAmount.value).not.toBeUndefined();
      expect(maxTransferableTokenAmount.value?.uint256.asString).toBe(
        mockedAmountBeforeFees.asString,
      );
    });

    it('is undefined when calculation fails with an exception', async () => {
      const totalAmount = ref(
        new TokenAmount({ amount: '1000', token: TOKEN }),
      ) as Ref<TokenAmount>;
      const chain = ref(CHAIN);
      const mockedGetAmountBeforeFees = vi.fn().mockImplementation(() => {
        throw new Error('error');
      });

      Object.defineProperty(requestManagerService, 'getAmountBeforeFees', {
        value: mockedGetAmountBeforeFees,
      });

      const { maxTransferableTokenAmount } = useMaxTransferableTokenAmount(totalAmount, chain);
      await flushPromises();

      expect(mockedGetAmountBeforeFees).toHaveBeenCalled();
      expect(maxTransferableTokenAmount.value).toBeUndefined();
    });
  });

  describe('loading', () => {
    it('indicates that a recalculation for maxTransferableTokenAmount is running', async () => {
      const totalAmount = ref(
        new TokenAmount({ amount: '1000', token: TOKEN }),
      ) as Ref<TokenAmount>;
      const chain = ref(CHAIN);

      const { loading } = useMaxTransferableTokenAmount(totalAmount, chain);

      expect(loading.value).toBe(true);
      await flushPromises();
      expect(loading.value).toBe(false);
    });
  });

  it('watches for changes on the provided token amount and recalculates maxTransferableTokenAmount', async () => {
    const totalAmount = ref(undefined) as Ref<TokenAmount | undefined>;
    const chain = ref(CHAIN);

    const { maxTransferableTokenAmount } = useMaxTransferableTokenAmount(totalAmount, chain);
    await flushPromises();

    expect(maxTransferableTokenAmount.value).toBeUndefined();

    totalAmount.value = new TokenAmount({ amount: '1000', token: TOKEN });
    const mockedAmountBeforeFees = totalAmount.value.uint256.subtract(new UInt256('100'));
    Object.defineProperty(requestManagerService, 'getAmountBeforeFees', {
      value: vi.fn().mockReturnValue(mockedAmountBeforeFees),
    });

    await flushPromises();

    expect(maxTransferableTokenAmount.value).not.toBeUndefined();
    expect(maxTransferableTokenAmount.value?.uint256.asString).toBe(
      mockedAmountBeforeFees.asString,
    );
  });
});
