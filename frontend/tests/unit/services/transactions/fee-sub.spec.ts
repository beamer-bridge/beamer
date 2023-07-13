import {
  amountCanBeSubsidized,
  contract_amountCanBeSubsidized,
} from '@/services/transactions/fee-sub';
import * as requestManagerService from '@/services/transactions/request-manager';
import * as transactionUtils from '@/services/transactions/utils';
import type { Chain, Token } from '@/types/data';
import { TokenAmount } from '@/types/token-amount';
import { UInt256 } from '@/types/uint-256';
import { generateChain, generateToken, getRandomEthereumAddress } from '~/utils/data_generators';
import { MockedBigNumber } from '~/utils/mocks/ethers';
import {
  mockGetERC20Contract,
  mockGetFeeSubContract,
} from '~/utils/mocks/services/transactions/utils';

vi.mock('@/services/transactions/utils');
vi.mock('@/services/transactions/request-manager');
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
  describe('contract_amountCanBeSubsidized', () => {
    it('returns false when a feeSubAddress is not defined for the chain', async () => {
      const { sourceChain, targetChain, token, tokenAmount } = createConfig({
        sourceChain: generateChain({ feeSubAddress: undefined }),
      });

      const canBeSubsidized = await contract_amountCanBeSubsidized(
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

      const canBeSubsdized = await contract_amountCanBeSubsidized(
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

    it('returns false when the defined min threshold in the contract is set to 0', async () => {
      const { sourceChain, targetChain, token, tokenAmount } = createConfig({
        sourceChain: generateChain({ feeSubAddress: getRandomEthereumAddress() }),
      });

      const feeSubContract = mockGetFeeSubContract();
      const mockedMinThreshold = new MockedBigNumber('0');
      mockedMinThreshold.isZero = vi.fn().mockReturnValue(true);
      feeSubContract.minimumAmounts = vi.fn().mockResolvedValue(mockedMinThreshold);

      const canBeSubsidized = await amountCanBeSubsidized(
        sourceChain,
        targetChain,
        token,
        tokenAmount,
      );
      expect(canBeSubsidized).toEqual(false);
    });

    it('returns false if the amount to be sent is lower than the threshold', async () => {
      const { sourceChain, targetChain, token, tokenAmount } = createConfig({
        sourceChain: generateChain({ feeSubAddress: getRandomEthereumAddress() }),
        amount: '10',
      });

      const feeSubContract = mockGetFeeSubContract();
      const mockedMinThreshold = new MockedBigNumber('100');
      mockedMinThreshold.isZero = vi.fn().mockReturnValue(false);
      mockedMinThreshold.gt = vi.fn().mockReturnValue(true);
      feeSubContract.minimumAmounts = vi.fn().mockResolvedValue(mockedMinThreshold);

      const canBeSubsidized = await amountCanBeSubsidized(
        sourceChain,
        targetChain,
        token,
        tokenAmount,
      );
      expect(canBeSubsidized).toEqual(false);
    });

    it('returns false if the contract has not enough funds to subsidize the fees for the specified amount', async () => {
      const { sourceChain, targetChain, token, tokenAmount } = createConfig({
        sourceChain: generateChain({ feeSubAddress: getRandomEthereumAddress() }),
        amount: '10',
      });

      const feeSubContract = mockGetFeeSubContract();
      const mockTokenContract = mockGetERC20Contract();
      const mockedMinThreshold = new MockedBigNumber('100');
      const mockedContractTokenBalance = new MockedBigNumber('500');
      const totalFees = new UInt256('1000');
      feeSubContract.minimumAmounts = vi.fn().mockResolvedValue(mockedMinThreshold);
      mockedMinThreshold.isZero = vi.fn().mockReturnValue(false);
      mockedMinThreshold.gt = vi.fn().mockReturnValue(false);
      mockedContractTokenBalance.lt = vi.fn().mockReturnValue(true);
      mockTokenContract.balanceOf = vi.fn().mockResolvedValue(mockedContractTokenBalance);

      vi.spyOn(transactionUtils, 'getReadOnlyContract')
        .mockReturnValueOnce(feeSubContract)
        .mockReturnValueOnce(mockTokenContract);

      vi.spyOn(requestManagerService, 'getRequestFee').mockResolvedValue(totalFees);

      const canBeSubsidized = await amountCanBeSubsidized(
        sourceChain,
        targetChain,
        token,
        tokenAmount,
      );
      expect(canBeSubsidized).toEqual(false);
    });

    it('returns true if the contract can subsidize the transfer', async () => {
      const { sourceChain, targetChain, token, tokenAmount } = createConfig({
        sourceChain: generateChain({ feeSubAddress: getRandomEthereumAddress() }),
        amount: '10',
      });

      const feeSubContract = mockGetFeeSubContract();
      const mockTokenContract = mockGetERC20Contract();
      const mockedMinThreshold = new MockedBigNumber('100');
      const mockedContractTokenBalance = new MockedBigNumber('500');
      const totalFees = new UInt256('1');
      feeSubContract.minimumAmounts = vi.fn().mockResolvedValue(mockedMinThreshold);
      mockedMinThreshold.isZero = vi.fn().mockReturnValue(false);
      mockedMinThreshold.gt = vi.fn().mockReturnValue(false);
      mockedContractTokenBalance.lt = vi.fn().mockReturnValue(false);
      mockTokenContract.balanceOf = vi.fn().mockResolvedValue(mockedContractTokenBalance);

      vi.spyOn(transactionUtils, 'getReadOnlyContract')
        .mockReturnValueOnce(feeSubContract)
        .mockReturnValueOnce(mockTokenContract);

      vi.spyOn(requestManagerService, 'getRequestFee').mockResolvedValue(totalFees);

      const canBeSubsidized = await amountCanBeSubsidized(
        sourceChain,
        targetChain,
        token,
        tokenAmount,
      );
      expect(canBeSubsidized).toEqual(true);
    });
  });
});
