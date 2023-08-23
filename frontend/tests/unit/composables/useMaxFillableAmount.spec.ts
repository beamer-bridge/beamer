import { ref } from 'vue';

import { useMaxFillableAmount } from '@/composables/useMaxFillableAmount';
import * as useTokenBalanceComposable from '@/composables/useTokenBalance';
import * as web3ProviderService from '@/services/web3-provider';
import { TokenAmount } from '@/types/token-amount';
import * as agentAddresses from '@/utils/agentAddresses';
import { generateChain, generateToken, getRandomEthereumAddress } from '~/utils/data_generators';
import { MockedEthereumWallet } from '~/utils/mocks/ethereum-provider';

vi.mock('@/services/web3-provider');
vi.mock('@/composables/useTokenBalance');
vi.mock('@/utils/agentAddresses');

const TOKEN = ref(generateToken());
const CHAIN = ref(generateChain());

describe('useMaxFillableAmount', () => {
  beforeEach(() => {
    Object.defineProperties(web3ProviderService, {
      createEthereumProvider: {
        value: vi.fn().mockResolvedValue(new MockedEthereumWallet()),
      },
    });
    Object.defineProperties(agentAddresses, {
      getEnvBasedAgentAddresses: {
        value: vi.fn().mockReturnValue([getRandomEthereumAddress()]),
      },
    });
  });

  describe('amount', () => {
    it('is undefined when no balance is available', () => {
      Object.defineProperty(useTokenBalanceComposable, 'useTokenBalance', {
        value: vi.fn().mockReturnValue({
          balance: ref(undefined),
        }),
      });

      const { amount } = useMaxFillableAmount(CHAIN, TOKEN);

      expect(amount.value).toBeUndefined();
    });

    it('uses the maximum balance of the agents', () => {
      Object.defineProperty(agentAddresses, 'getEnvBasedAgentAddresses', {
        value: vi.fn().mockReturnValue([getRandomEthereumAddress(), getRandomEthereumAddress()]),
      });
      Object.defineProperty(useTokenBalanceComposable, 'useTokenBalance', {
        value: vi
          .fn()
          .mockReturnValueOnce({
            balance: ref(TokenAmount.parse('10', TOKEN.value)),
          })
          .mockReturnValue({
            balance: ref(TokenAmount.parse('20', TOKEN.value)),
          }),
      });

      const { amount } = useMaxFillableAmount(CHAIN, TOKEN);

      expect(amount.value).toEqual(TokenAmount.parse('20', TOKEN.value));
    });
  });
});
