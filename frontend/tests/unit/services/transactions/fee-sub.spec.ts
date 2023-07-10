import { amountCanBeSubsidized } from '@/services/transactions/fee-sub';
import type { Chain, Token } from '@/types/data';
import { TokenAmount } from '@/types/token-amount';
import { generateChain, generateToken } from '~/utils/data_generators';
import { MockedBigNumber } from '~/utils/mocks/ethers';
import { mockGetFeeSubContract } from '~/utils/mocks/services/transactions/utils';

vi.mock('@/services/transactions/utils');
vi.mock('@ethersproject/providers');

function createConfig(options?: { chain?: Chain; token?: Token; amount?: string }) {
  const token = options?.token ?? generateToken();
  const amount = options?.amount ?? '123';

  const tokenAmount = new TokenAmount({ amount, token });

  return {
    chain: options?.chain ?? generateChain(),
    token,
    tokenAmount,
  };
}

describe('fee-sub', () => {
  beforeEach(() => {
    mockGetFeeSubContract();
  });
  describe('amountCanBeSubsidized', () => {
    it('returns false when a feeSubAddress is not defined for the chain', async () => {
      const { chain, token, tokenAmount } = createConfig({
        chain: generateChain({ feeSubAddress: undefined }),
      });

      const canBeSubsidized = await amountCanBeSubsidized(chain, token, tokenAmount);
      expect(canBeSubsidized).toEqual(false);
    });
    it('returns false if minimum amount threshold is zero for the specific token', async () => {
      const { chain, token, tokenAmount } = createConfig({
        chain: generateChain({ feeSubAddress: '0x123' }),
      });

      const contract = mockGetFeeSubContract();
      const minimumAmountThreshold = new MockedBigNumber('0');
      minimumAmountThreshold.isZero = vi.fn().mockReturnValue(true);
      contract.minimumAmounts = vi.fn().mockResolvedValue(minimumAmountThreshold);

      const canBeSubsdized = await amountCanBeSubsidized(chain, token, tokenAmount);
      expect(canBeSubsdized).toEqual(false);
    });
    it('returns false if the token amount to be subsidized is lower than the minimum amount threshold defined for that token', async () => {
      const { chain, token, tokenAmount } = createConfig({
        chain: generateChain({ feeSubAddress: '0x123' }),
        amount: '100',
      });

      const contract = mockGetFeeSubContract();
      const minimumAmountThreshold = new MockedBigNumber('101');
      contract.minimumAmounts = vi.fn().mockResolvedValue(minimumAmountThreshold);

      const canBeSubsdized = await amountCanBeSubsidized(chain, token, tokenAmount);
      expect(canBeSubsdized).toEqual(false);
    });

    it('returns true if all the conditions are met', async () => {
      const { chain, token, tokenAmount } = createConfig({
        chain: generateChain({ feeSubAddress: '0x123' }),
        amount: '100',
      });

      const contract = mockGetFeeSubContract();
      const minimumAmountThreshold = new MockedBigNumber('99');
      contract.minimumAmounts = vi.fn().mockResolvedValue(minimumAmountThreshold);

      const canBeSubsdized = await amountCanBeSubsidized(chain, token, tokenAmount);
      expect(canBeSubsdized).toEqual(true);
    });
  });
});
