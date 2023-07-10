import { flushPromises } from '@vue/test-utils';
import type { Ref } from 'vue';
import { ref } from 'vue';

import { useMaxTransferableTokenAmount } from '@/composables/useMaxTransferableTokenAmount';
import * as feeSubService from '@/services/transactions/fee-sub';
import * as requestManagerService from '@/services/transactions/request-manager';
import { TokenAmount } from '@/types/token-amount';
import { UInt256 } from '@/types/uint-256';
import { generateChain, generateToken } from '~/utils/data_generators';

const TOKEN = generateToken();
const SOURCE_CHAIN = generateChain();
const TARGET_CHAIN = generateChain();
const SOURCE_CHAIN_REF = ref(SOURCE_CHAIN);
const TARGET_CHAIN_REF = ref(TARGET_CHAIN);
const TOKEN_AMOUNT = ref(new TokenAmount({ amount: '1000', token: TOKEN })) as Ref<TokenAmount>;

vi.mock('@/services/transactions/request-manager');
vi.mock('@/services/transactions/fee-sub');

describe('useMaxTransferableTokenAmount', () => {
  beforeEach(() => {
    global.console.error = vi.fn();
  });

  describe('maxTransferableTokenAmount', () => {
    it('is undefined when provided total amount is undefined', async () => {
      const totalAmount = ref(undefined);

      const { maxTransferableTokenAmount } = useMaxTransferableTokenAmount(
        totalAmount,
        SOURCE_CHAIN_REF,
        TARGET_CHAIN_REF,
      );
      await flushPromises();

      expect(maxTransferableTokenAmount.value).toBeUndefined();
    });

    it('is undefined when provided source chain is undefined', async () => {
      const sourceChain = ref(undefined);

      const { maxTransferableTokenAmount } = useMaxTransferableTokenAmount(
        TOKEN_AMOUNT,
        sourceChain,
        TARGET_CHAIN_REF,
      );
      await flushPromises();

      expect(maxTransferableTokenAmount.value).toBeUndefined();
    });

    describe('if transfer can be subsidized', () => {
      it('holds the full token balance as a transferable amount', async () => {
        const totalAmount = ref(
          new TokenAmount({ amount: '1000', token: TOKEN }),
        ) as Ref<TokenAmount>;

        Object.defineProperty(feeSubService, 'amountCanBeSubsidized', {
          value: vi.fn().mockReturnValue(true),
        });

        const { maxTransferableTokenAmount } = useMaxTransferableTokenAmount(
          totalAmount,
          SOURCE_CHAIN_REF,
          TARGET_CHAIN_REF,
        );
        await flushPromises();

        expect(maxTransferableTokenAmount.value).not.toBeUndefined();
        expect(maxTransferableTokenAmount.value?.uint256.asString).toBe(
          totalAmount.value.uint256.asString,
        );
      });
    });
    describe('if transfer cannot be subsidized', () => {
      it('holds the actual transferable amount derived from the provided total amount', async () => {
        const totalAmount = ref(
          new TokenAmount({ amount: '1000', token: TOKEN }),
        ) as Ref<TokenAmount>;

        const mockedAmountBeforeFees = totalAmount.value.uint256.subtract(new UInt256('100'));
        Object.defineProperty(requestManagerService, 'getAmountBeforeFees', {
          value: vi.fn().mockReturnValue(mockedAmountBeforeFees),
        });

        const { maxTransferableTokenAmount } = useMaxTransferableTokenAmount(
          totalAmount,
          SOURCE_CHAIN_REF,
          TARGET_CHAIN_REF,
        );
        await flushPromises();

        expect(maxTransferableTokenAmount.value).not.toBeUndefined();
        expect(maxTransferableTokenAmount.value?.uint256.asString).toBe(
          mockedAmountBeforeFees.asString,
        );
      });
    });

    it('is undefined when calculation fails with an exception', async () => {
      const mockedGetAmountBeforeFees = vi.fn().mockImplementation(() => {
        throw new Error('error');
      });

      Object.defineProperty(requestManagerService, 'getAmountBeforeFees', {
        value: mockedGetAmountBeforeFees,
      });

      const { maxTransferableTokenAmount } = useMaxTransferableTokenAmount(
        TOKEN_AMOUNT,
        SOURCE_CHAIN_REF,
        TARGET_CHAIN_REF,
      );
      await flushPromises();

      expect(mockedGetAmountBeforeFees).toHaveBeenCalled();
      expect(maxTransferableTokenAmount.value).toBeUndefined();
    });
  });

  describe('loading', () => {
    it('indicates that the transferable token amount is being fetched', async () => {
      const { loading } = useMaxTransferableTokenAmount(
        TOKEN_AMOUNT,
        SOURCE_CHAIN_REF,
        TARGET_CHAIN_REF,
      );

      expect(loading.value).toBe(true);
      await flushPromises();
      expect(loading.value).toBe(false);
    });
  });

  it('watches for changes on the provided token amount and refetches the transferable token amount', async () => {
    const totalAmount = ref(undefined) as Ref<TokenAmount | undefined>;

    const { maxTransferableTokenAmount } = useMaxTransferableTokenAmount(
      totalAmount,
      SOURCE_CHAIN_REF,
      TARGET_CHAIN_REF,
    );
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
