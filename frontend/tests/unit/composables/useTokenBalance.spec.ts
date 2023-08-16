import { flushPromises } from '@vue/test-utils';
import { ref, shallowRef } from 'vue';

import { useTokenBalance } from '@/composables/useTokenBalance';
import * as tokenService from '@/services/transactions/token';
import { TokenAmount } from '@/types/token-amount';
import { generateToken, getRandomEthereumAddress } from '~/utils/data_generators';
import { MockedEthereumWallet } from '~/utils/mocks/ethereum-provider';

vi.mock('@/services/transactions/token');

const ACCOUNT_ADDRESS = ref(getRandomEthereumAddress());
const PROVIDER = shallowRef(
  new MockedEthereumWallet({
    signerAddress: getRandomEthereumAddress(),
  }),
);
const TOKEN = ref(generateToken());

describe('useTokenBalance', () => {
  describe('balance', () => {
    it('is undefined when provided ethereum provider is not defined', () => {
      const provider = ref(undefined);

      const { balance } = useTokenBalance(provider, ACCOUNT_ADDRESS, TOKEN);

      expect(balance.value).toBeUndefined();
    });
    it('is undefined when provided token is not defined', () => {
      const token = ref(undefined);

      const { balance } = useTokenBalance(PROVIDER, ACCOUNT_ADDRESS, token);

      expect(balance.value).toBeUndefined();
    });
    it('is undefined when provided account address is not defined', () => {
      const accountAddress = ref(undefined);

      const { balance } = useTokenBalance(PROVIDER, accountAddress, TOKEN);

      expect(balance.value).toBeUndefined();
    });
    it('is defined when all conditions are met for its calculation', async () => {
      const token = ref(generateToken());
      Object.defineProperty(tokenService, 'getTokenBalance', {
        value: vi.fn().mockResolvedValue(TokenAmount.parse('1', token.value)),
      });
      const { balance } = useTokenBalance(PROVIDER, ACCOUNT_ADDRESS, token);
      await flushPromises();

      expect(balance.value).not.toBeUndefined();
      expect(balance.value?.token).toEqual(token.value);
    });
  });

  describe('formattedBalance', () => {
    it('holds the user token balance represented as a human readable text', async () => {
      const token = ref(generateToken());

      Object.defineProperty(tokenService, 'getTokenBalance', {
        value: vi.fn().mockResolvedValue(TokenAmount.parse('1', token.value)),
      });

      const { formattedBalance } = useTokenBalance(PROVIDER, ACCOUNT_ADDRESS, token);
      await flushPromises();
      expect(formattedBalance.value).not.toBeUndefined();
      expect(formattedBalance.value).not.toHaveLength(0);
    });
  });

  describe('error', () => {
    it('is undefined when no errors occured', async () => {
      const { error } = useTokenBalance(PROVIDER, ACCOUNT_ADDRESS, TOKEN);
      await flushPromises();
      expect(error.value).toBeUndefined();
    });

    it('holds the rejected error of a failed token balance "fetch" operation', async () => {
      Object.defineProperty(tokenService, 'getTokenBalance', {
        value: vi.fn().mockImplementation(() => {
          throw new Error('Failed fetching token balance');
        }),
      });

      const { error } = useTokenBalance(PROVIDER, ACCOUNT_ADDRESS, TOKEN);
      await flushPromises();
      expect(error.value).toBe('Failed fetching token balance');
    });
    it('holds the rejected error of a failed token balance "listener attach" operation', async () => {
      Object.defineProperty(tokenService, 'listenOnTokenBalanceChange', {
        value: vi.fn().mockImplementation(() => {
          throw new Error('Failed attaching listeners on token balance');
        }),
      });

      const { error } = useTokenBalance(PROVIDER, ACCOUNT_ADDRESS, TOKEN);
      await flushPromises();
      expect(error.value).toBe('Failed attaching listeners on token balance');
    });
  });

  it('detaches all contract listeners when parameters transition to invalid state', async () => {
    const token = ref(generateToken());
    const contractWithListeners = {
      removeAllListeners: vi.fn(),
    };

    Object.defineProperty(tokenService, 'listenOnTokenBalanceChange', {
      value: vi.fn().mockReturnValue(contractWithListeners),
    });

    useTokenBalance(PROVIDER, ACCOUNT_ADDRESS, token);

    token.value = generateToken();
    await flushPromises();

    expect(contractWithListeners.removeAllListeners).toHaveBeenCalledOnce();
  });
});
