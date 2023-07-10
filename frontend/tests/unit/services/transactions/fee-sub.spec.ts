import { amountCanBeSubsidized } from '@/services/transactions/fee-sub';
import type { Chain, Token } from '@/types/data';
import { TokenAmount } from '@/types/token-amount';
import { generateChain, generateToken } from '~/utils/data_generators';
import { mockGetFeeSubContract } from '~/utils/mocks/services/transactions/utils';

vi.mock('@/services/transactions/utils');
vi.mock('@ethersproject/providers');

function createConfig(options?: {
  sourceChain?: Chain;
  targetChain?: Chain;
  token?: Token;
  amount?: string;
}) {
  const token = options?.token ?? generateToken();
  const amount = options?.amount ?? '123';

  const tokenAmount = new TokenAmount({ amount, token });

  return {
    sourceChain: options?.sourceChain ?? generateChain(),
    targetChain: options?.targetChain ?? generateChain(),
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
      const { sourceChain, targetChain, token, tokenAmount } = createConfig({
        sourceChain: generateChain({ feeSubAddress: undefined }),
      });

      const canBeSubsidized = await amountCanBeSubsidized(
        sourceChain,
        targetChain,
        token,
        tokenAmount,
      );
      expect(canBeSubsidized).toEqual(false);
    });

    it('returns whether an amount can be subsidized or not', async () => {
      const { sourceChain, targetChain, token, tokenAmount } = createConfig({
        sourceChain: generateChain({ feeSubAddress: '0x123' }),
        amount: '100',
      });

      const contract = mockGetFeeSubContract();
      contract.tokenAmountCanBeSubsidized = vi.fn().mockResolvedValue(true);

      const canBeSubsdized = await amountCanBeSubsidized(
        sourceChain,
        targetChain,
        token,
        tokenAmount,
      );

      expect(contract.tokenAmountCanBeSubsidized).toHaveBeenNthCalledWith(
        1,
        targetChain.identifier,
        token.address,
        tokenAmount.uint256.asBigNumber,
      );
      expect(canBeSubsdized).toEqual(true);
    });
  });
});
