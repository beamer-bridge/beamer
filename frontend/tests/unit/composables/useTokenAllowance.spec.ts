import { flushPromises } from '@vue/test-utils';
import { ref, shallowRef } from 'vue';

import { useTokenAllowance } from '@/composables/useTokenAllowance';
import * as tokenService from '@/services/transactions/token';
import { TokenAmount } from '@/types/token-amount';
import { UInt256 } from '@/types/uint-256';
import { generateChain, generateToken, getRandomEthereumAddress } from '~/utils/data_generators';
import { MockedEthereumWallet } from '~/utils/mocks/ethereum-provider';

vi.mock('@/services/transactions/token');

const PROVIDER = shallowRef(
  new MockedEthereumWallet({
    signerAddress: getRandomEthereumAddress(),
  }),
);
const TOKEN = ref(generateToken());
const SOURCE_CHAIN = ref(generateChain());

describe('useTokenAllowance', () => {
  describe('allowance', () => {
    it('is undefined when provided ethereum provider is not defined', () => {
      const provider = ref(undefined);

      const { allowance } = useTokenAllowance(provider, TOKEN, SOURCE_CHAIN);

      expect(allowance.value).toBeUndefined();
    });

    it('is undefined when provided token is not defined', () => {
      const token = ref(undefined);

      const { allowance } = useTokenAllowance(PROVIDER, token, SOURCE_CHAIN);

      expect(allowance.value).toBeUndefined();
    });

    it('is undefined when provided token is not defined', () => {
      const sourceChain = ref(undefined);

      const { allowance } = useTokenAllowance(PROVIDER, TOKEN, sourceChain);

      expect(allowance.value).toBeUndefined();
    });

    it('is undefined when provided ethereum provider lacks an ethereum address', () => {
      const provider = shallowRef(new MockedEthereumWallet());

      const { allowance } = useTokenAllowance(provider, TOKEN, SOURCE_CHAIN);

      expect(allowance.value).toBeUndefined();
    });

    it('is defined when all conditions are met', async () => {
      const token = ref(generateToken());
      Object.defineProperty(tokenService, 'getTokenAllowance', {
        value: vi.fn().mockResolvedValue(TokenAmount.parse('1', token.value)),
      });
      const { allowance } = useTokenAllowance(PROVIDER, token, SOURCE_CHAIN);
      await flushPromises();

      expect(allowance.value).not.toBeUndefined();
      expect(allowance.value?.token).toEqual(token.value);
    });
  });

  describe('allowanceBelowMax', () => {
    it('is true when the allowance is below the maximum uint256 value', async () => {
      const token = ref(generateToken());

      Object.defineProperty(tokenService, 'getTokenAllowance', {
        value: vi.fn().mockResolvedValue(TokenAmount.parse('1', token.value)),
      });

      const { allowanceBelowMax } = useTokenAllowance(PROVIDER, token, SOURCE_CHAIN);
      await flushPromises();
      expect(allowanceBelowMax.value).toBe(true);
    });

    it('is false when the allowance is the maximum uint256 value', async () => {
      const token = ref(generateToken());

      Object.defineProperty(tokenService, 'getTokenAllowance', {
        value: vi.fn().mockResolvedValue(TokenAmount.parse(UInt256.max().asString, token.value)),
      });

      const { allowanceBelowMax } = useTokenAllowance(PROVIDER, token, SOURCE_CHAIN);
      await flushPromises();
      expect(allowanceBelowMax.value).toBe(false);
    });
  });

  describe('if a fee subsidy contract is defined', () => {
    it('checks the allowance for the fee sub contract', () => {
      const sourceChain = ref(generateChain({ feeSubAddress: '0x123' }));
      useTokenAllowance(PROVIDER, TOKEN, sourceChain);

      expect(tokenService.getTokenAllowance).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        expect.any(String),
        sourceChain.value.feeSubAddress,
      );
    });
  });
  describe('if a fee subsidy contract is not defined', () => {
    it('checks the allowance for the request manager contract', () => {
      const sourceChain = ref(generateChain({ feeSubAddress: undefined }));
      useTokenAllowance(PROVIDER, TOKEN, sourceChain);

      expect(tokenService.getTokenAllowance).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        expect.any(String),
        sourceChain.value.requestManagerAddress,
      );
    });
  });
});
