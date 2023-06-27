import { JsonRpcProvider, JsonRpcSigner } from '@ethersproject/providers';

import {
  ensureTokenAllowance,
  getTokenAllowance,
  getTokenBalance,
  isAllowanceApproved,
  listenOnTokenBalanceChange,
} from '@/services/transactions/token';
import { UInt256 } from '@/types/uint-256';
import { generateToken, getRandomEthereumAddress } from '~/utils/data_generators';
import { MockedEthereumProvider } from '~/utils/mocks/ethereum-provider';
import {
  mockGetERC20Contract,
  mockGetSafeEventHandler,
} from '~/utils/mocks/services/transactions/utils';

vi.mock('@/services/transactions/utils');
vi.mock('@ethersproject/providers');

const PROVIDER = new JsonRpcProvider();
const SIGNER = new JsonRpcSigner(undefined, PROVIDER);
const SIGNER_ADDRESS = getRandomEthereumAddress();
const ETHEREUM_PROVIDER = new MockedEthereumProvider({
  signer: SIGNER,
  signerAddress: SIGNER_ADDRESS,
});

describe('token', () => {
  beforeEach(() => {
    SIGNER.getAddress = vi.fn().mockReturnValue(getRandomEthereumAddress());
    SIGNER.getChainId = vi.fn().mockReturnValue(1);
    mockGetERC20Contract();
    mockGetSafeEventHandler();
  });

  describe('ensureTokenAllowance()', () => {
    describe("when signer's current token allowance is lower than the required amount", () => {
      it('triggers a token allowance approve transaction', async () => {
        const tokenAddress = getRandomEthereumAddress();
        const spender = getRandomEthereumAddress();
        const approvalAmount = new UInt256('1000');
        const allowance = '100';

        const mockedTokenContract = mockGetERC20Contract();
        mockedTokenContract.allowance = vi.fn().mockReturnValue(allowance);

        await ensureTokenAllowance(ETHEREUM_PROVIDER, tokenAddress, spender, approvalAmount);

        expect(mockedTokenContract.approve).toHaveBeenCalledWith(
          spender,
          approvalAmount.asBigNumber,
        );
      });
    });

    describe("when signer's current token allowance is higher than the required amount", () => {
      it("doesn't trigger an allowance approve transaction", async () => {
        const tokenAddress = getRandomEthereumAddress();
        const spender = getRandomEthereumAddress();
        const approvalAmount = new UInt256('1000');
        const allowance = '1100';

        const mockedTokenContract = mockGetERC20Contract();
        mockedTokenContract.allowance = vi.fn().mockReturnValue(allowance);

        await ensureTokenAllowance(ETHEREUM_PROVIDER, tokenAddress, spender, approvalAmount);

        expect(mockedTokenContract.approve).not.toHaveBeenCalled();
      });
    });
  });

  describe('isAllowanceApproved()', () => {
    describe("when signer's current token allowance is lower than the required amount", () => {
      it('returns false', async () => {
        const tokenAddress = getRandomEthereumAddress();
        const spender = getRandomEthereumAddress();
        const approvalAmount = new UInt256('1000');
        const allowance = '100';

        const mockedTokenContract = mockGetERC20Contract();
        mockedTokenContract.allowance = vi.fn().mockReturnValue(allowance);

        const result = await isAllowanceApproved(
          ETHEREUM_PROVIDER,
          tokenAddress,
          SIGNER_ADDRESS,
          spender,
          approvalAmount,
        );

        expect(result).toBe(false);
      });
    });

    describe("when signer's current token allowance is higher than the required amount", () => {
      it('returns true', async () => {
        const tokenAddress = getRandomEthereumAddress();
        const spender = getRandomEthereumAddress();
        const approvalAmount = new UInt256('1000');
        const allowance = '1100';

        const mockedTokenContract = mockGetERC20Contract();
        mockedTokenContract.allowance = vi.fn().mockReturnValue(allowance);

        const result = await isAllowanceApproved(
          ETHEREUM_PROVIDER,
          tokenAddress,
          SIGNER_ADDRESS,
          spender,
          approvalAmount,
        );

        expect(result).toBe(true);
      });
    });
  });

  describe('getTokenBalance()', () => {
    it('returns the token balance of the provided account address', async () => {
      const token = generateToken({ decimals: 1 });
      const accountAddress = getRandomEthereumAddress();

      const mockedTokenContract = mockGetERC20Contract();
      mockedTokenContract.balanceOf = vi.fn().mockReturnValue('1000');

      const result = await getTokenBalance(new MockedEthereumProvider(), token, accountAddress);

      expect(mockedTokenContract.balanceOf).toHaveBeenCalled();
      expect(result.uint256.asString).toBe('1000');
    });
  });

  describe('getTokenAllowance()', () => {
    it('returns the token allowance for the specified spender and owner', async () => {
      const token = generateToken();
      const ownerAddress = getRandomEthereumAddress();
      const spenderAddress = getRandomEthereumAddress();

      const mockedTokenContract = mockGetERC20Contract();
      mockedTokenContract.allowance = vi.fn().mockReturnValue('99');

      const result = await getTokenAllowance(
        new MockedEthereumProvider(),
        token,
        ownerAddress,
        spenderAddress,
      );

      expect(mockedTokenContract.allowance).toHaveBeenCalled();
      expect(result.uint256.asString).toBe('99');
    });
  });

  describe('listenOnTokenBalanceChange()', () => {
    it('attaches a callback handler on token balance increase', () => {
      const onIncrease = vi.fn();
      const addressToListen = getRandomEthereumAddress();

      const options = {
        provider: new MockedEthereumProvider(),
        token: generateToken(),
        addressToListen,
        onReduce: vi.fn(),
        onIncrease,
      };

      const contract = mockGetERC20Contract();
      contract.filters.Transfer = vi.fn().mockReturnValue('test-filter');

      listenOnTokenBalanceChange(options);

      expect(contract.filters.Transfer).toHaveBeenCalledWith(undefined, addressToListen);
      expect(contract.on).toHaveBeenCalledWith('test-filter', onIncrease);
    });

    it('attaches a callback handler on token balance decrease', () => {
      const onReduce = vi.fn();
      const addressToListen = getRandomEthereumAddress();

      const options = {
        provider: new MockedEthereumProvider(),
        token: generateToken(),
        addressToListen,
        onReduce: onReduce,
        onIncrease: vi.fn(),
      };

      const contract = mockGetERC20Contract();
      contract.filters.Transfer = vi.fn().mockReturnValue('test-filter');

      listenOnTokenBalanceChange(options);

      expect(contract.filters.Transfer).toHaveBeenCalledWith(addressToListen, undefined);
      expect(contract.on).toHaveBeenCalledWith('test-filter', onReduce);
    });
  });
});
