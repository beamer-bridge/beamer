import { JsonRpcProvider, JsonRpcSigner } from '@ethersproject/providers';
import { flushPromises } from '@vue/test-utils';

import {
  failWhenRequestExpires,
  getAmountBeforeFees,
  getRequestData,
  getRequestFee,
  getRequestInformation,
  getTimeToExpiredMilliseconds,
  getTokenMinLpFee,
  getTokenTransferLimit,
  isRequestClaimed,
  isRequestExpiredByLatestBlock,
  isRequestExpiredByLocalClock,
  listenOnClaimCountChange,
  sendRequestTransaction,
  waitUntilClaimsWithdrawn,
  withdrawRequest,
} from '@/services/transactions/request-manager';
import * as transactionUtils from '@/services/transactions/utils';
import { TokenAmount } from '@/types/token-amount';
import { UInt256 } from '@/types/uint-256';
import {
  generateToken,
  getRandomEthereumAddress,
  getRandomNumber,
  getRandomString,
  getRandomUrl,
} from '~/utils/data_generators';
import { MockedRequest, MockedToken } from '~/utils/mocks/beamer';
import { MockedEthereumWallet } from '~/utils/mocks/ethereum-provider';
import {
  MockedBigNumber,
  MockedTransaction,
  MockedTransactionReceipt,
} from '~/utils/mocks/ethers';
import {
  mockGetLatestBlock,
  mockGetProvider,
  mockGetRequestManagerContract,
  mockGetSafeEventHandler,
} from '~/utils/mocks/services/transactions/utils';

vi.mock('@/services/transactions/utils');
vi.mock('@ethersproject/providers');

const REQUEST_MANAGER_ADDRESS = getRandomEthereumAddress();
const RPC_URL = getRandomUrl('rpc');
const PROVIDER = new JsonRpcProvider();
const SIGNER = new JsonRpcSigner(undefined, PROVIDER);
const DEFAULT_REQUEST_IDENTIFIER = '1';
const ETHEREUM_PROVIDER = new MockedEthereumWallet({ signer: SIGNER });

describe('request-manager', () => {
  beforeEach(() => {
    global.console.error = vi.fn();
    global.Date.now = vi.fn();

    SIGNER.getChainId = vi.fn().mockReturnValue(1);

    mockGetSafeEventHandler();
    mockGetRequestManagerContract();
    mockGetLatestBlock();
    mockGetProvider();
  });

  describe('getTokenTransferLimit()', () => {
    it('returns the defined transfer limit for a token', async () => {
      const tokenDefinedTransferLimit = '100';
      const tokenAddress = getRandomEthereumAddress();
      const token = new MockedToken({ transferLimit: tokenDefinedTransferLimit });
      const contract = mockGetRequestManagerContract();
      contract.tokens = vi.fn().mockReturnValue(token);

      const transferLimit = await getTokenTransferLimit(
        RPC_URL,
        REQUEST_MANAGER_ADDRESS,
        tokenAddress,
      );

      expect(transferLimit).not.toBeUndefined();
      expect(transferLimit.asString).toBe(tokenDefinedTransferLimit);
    });
  });

  describe('getTokenMinLpFee()', () => {
    it('returns the current minLpFee for a token', async () => {
      const definedMinLpFee = '100';
      const tokenAddress = getRandomEthereumAddress();
      const contract = mockGetRequestManagerContract();
      const targetChainId = 5;
      contract.minLpFee = vi.fn().mockResolvedValue(definedMinLpFee);

      const minLpFee = await getTokenMinLpFee(
        RPC_URL,
        REQUEST_MANAGER_ADDRESS,
        targetChainId,
        tokenAddress,
      );

      expect(minLpFee).not.toBeUndefined();
      expect(minLpFee.asString).toBe(definedMinLpFee);
    });
  });

  describe('getAmountBeforeFees()', () => {
    it('returns the amount before fees for the provided total amount', async () => {
      const DECIMALS = 4;
      const token = generateToken({ decimals: DECIMALS });
      const amount = TokenAmount.parse('10', token);
      const chainId = 5;

      const contract = mockGetRequestManagerContract();
      contract.transferableAmount = vi.fn().mockResolvedValue(new MockedBigNumber('500'));

      const result = await getAmountBeforeFees(amount, RPC_URL, REQUEST_MANAGER_ADDRESS, chainId);

      expect(contract.transferableAmount).toHaveBeenCalledWith(
        chainId,
        token.address,
        amount.uint256.asBigNumber,
      );
      expect(result.asString).toBe('500');
    });
  });

  describe('getRequestFee()', () => {
    it('returns the calculated fee for the provided token amount', async () => {
      const token = generateToken();
      const transferAmount = TokenAmount.parse('100', token);
      const targetChainId = 5;

      const contract = mockGetRequestManagerContract();
      contract.totalFee = vi.fn().mockReturnValue('50');

      const transferLimit = await getRequestFee(
        RPC_URL,
        REQUEST_MANAGER_ADDRESS,
        transferAmount,
        targetChainId,
      );

      expect(transferLimit.asString).toBe('50');
    });
  });

  describe('sendRequestTransaction()', () => {
    const targetChainId = 1;
    const sourceTokenAddress = getRandomEthereumAddress();
    const targetTokenAddress = getRandomEthereumAddress();
    const targetAccount = getRandomEthereumAddress();
    const validityPeriod = new UInt256('600');
    const amount = new UInt256('1000');

    it('attempts to create a transfer request transaction', async () => {
      const contract = mockGetRequestManagerContract();
      const estimatedGas = '100';
      contract.estimateGas.createRequest = vi.fn().mockResolvedValue(estimatedGas);
      const transactionMock = new MockedTransaction();
      transactionMock.wait.mockResolvedValue({ transactionHash: '0xtxHash' });
      contract.createRequest = vi.fn().mockResolvedValue(transactionMock);

      await sendRequestTransaction(
        ETHEREUM_PROVIDER,
        amount,
        targetChainId,
        REQUEST_MANAGER_ADDRESS,
        sourceTokenAddress,
        targetTokenAddress,
        targetAccount,
        validityPeriod,
      );

      expect(contract.createRequest).toHaveBeenCalledWith(
        targetChainId,
        sourceTokenAddress,
        targetTokenAddress,
        targetAccount,
        amount.asBigNumber,
        validityPeriod.asBigNumber,
        { gasLimit: estimatedGas },
      );
    });

    it('throws an exception when a transfer request transaction failed', async () => {
      const contract = mockGetRequestManagerContract();

      contract.createRequest = vi.fn().mockImplementation(() => {
        throw new Error('transaction failed');
      });

      await expect(
        sendRequestTransaction(
          ETHEREUM_PROVIDER,
          amount,
          targetChainId,
          REQUEST_MANAGER_ADDRESS,
          sourceTokenAddress,
          targetTokenAddress,
          targetAccount,
          validityPeriod,
        ),
      ).rejects.toThrow('transaction failed');
    });
  });

  describe('getRequestInformation()', async () => {
    it('queries and returns the request information for a given transaction hash', async () => {
      const transactionHash = getRandomString();

      const contract = mockGetRequestManagerContract();
      contract.interface.parseLog = vi.fn().mockReturnValue({ args: { requestId: '1' } });

      const provider = mockGetProvider();
      provider.waitForTransaction = vi
        .fn()
        .mockReturnValue(new MockedTransactionReceipt({ logs: ['log'] }));

      Object.defineProperties(transactionUtils, {
        getConfirmationTimeBlocksForChain: {
          value: vi.fn().mockReturnValue(1),
        },
      });

      const identifier = await getRequestInformation(
        RPC_URL,
        REQUEST_MANAGER_ADDRESS,
        transactionHash,
      );

      expect(provider.waitForTransaction).toHaveBeenCalledWith(transactionHash, expect.anything());
      expect(identifier).toBe('1');
    });

    it('throws an error if the transaction has reverted', async () => {
      const transactionHash = getRandomString();

      mockGetRequestManagerContract();

      const provider = mockGetProvider();
      provider.waitForTransaction = vi
        .fn()
        .mockReturnValue(new MockedTransactionReceipt({ status: 0 }));

      await expect(
        getRequestInformation(RPC_URL, REQUEST_MANAGER_ADDRESS, transactionHash),
      ).rejects.toThrow('Transaction reverted on chain.');
    });

    it('throws an error if the transaction receipt is undefined', async () => {
      const transactionHash = getRandomString();

      mockGetRequestManagerContract();

      const provider = mockGetProvider();
      provider.waitForTransaction = vi.fn().mockReturnValue(undefined);

      await expect(
        getRequestInformation(RPC_URL, REQUEST_MANAGER_ADDRESS, transactionHash),
      ).rejects.toThrow('Transaction not found.');
    });

    it('throws an error if there are no logs in the transaction receipt', async () => {
      const transactionHash = getRandomString();

      const contract = mockGetRequestManagerContract();
      contract.interface.parseLog = vi.fn().mockImplementation(() => {
        throw new Error("Cannot read properties of undefined (reading '0')");
      });

      const provider = mockGetProvider();
      provider.waitForTransaction = vi
        .fn()
        .mockReturnValue(new MockedTransactionReceipt({ status: 1 }));

      await expect(
        getRequestInformation(RPC_URL, REQUEST_MANAGER_ADDRESS, transactionHash),
      ).rejects.toThrow("Request Failed. Couldn't retrieve Request ID.");
    });

    it('throws an error when the given transaction hash cannot be resolved to a request identifier', async () => {
      const transactionHash = getRandomString();

      const provider = mockGetProvider();
      provider.waitForTransaction = vi.fn().mockReturnValue(null);

      await expect(
        getRequestInformation(RPC_URL, REQUEST_MANAGER_ADDRESS, transactionHash),
      ).rejects.toThrow('Transaction not found.');
    });
  });

  describe('getRequestData()', async () => {
    it('returns the transfer request that corresponds to the provided request id', async () => {
      const validUntil = getRandomNumber();
      const activeClaims = getRandomNumber();
      const withdrawClaimId = getRandomNumber();

      const requestIdentifier = getRandomString();
      const request = new MockedRequest({ activeClaims, validUntil, withdrawClaimId });
      const contract = mockGetRequestManagerContract();
      contract.requests = vi.fn().mockReturnValue(request);

      const response = await getRequestData(RPC_URL, REQUEST_MANAGER_ADDRESS, requestIdentifier);

      expect(response).not.toBeUndefined();
      expect(response.validUntil).toBe(validUntil);
      expect(response.activeClaims).toBe(activeClaims);
      expect(response.withdrawClaimId.asNumber).toBe(withdrawClaimId);
    });

    it('throws an exception when a transfer request cannot be found for the provided request id', async () => {
      const requestIdentifier = getRandomString();

      await expect(
        getRequestData(RPC_URL, REQUEST_MANAGER_ADDRESS, requestIdentifier),
      ).rejects.toThrow('No request known for this identifier!');
    });
  });

  describe('getTimeToExpiredMilliseconds()', () => {
    it('returns the time until request expiry in milliseconds', () => {
      const timeNowSeconds = 90;
      const validUntilSeconds = 100;

      global.Date.now = vi.fn().mockReturnValue(timeNowSeconds * 1000);
      const millis = getTimeToExpiredMilliseconds(validUntilSeconds);

      expect(millis).toBe(10_000);
    });
    it('returns 0 if the provided validity timestamp is in the past', () => {
      const timeNowSeconds = 110;
      const validUntilSeconds = 100;

      global.Date.now = vi.fn().mockReturnValue(timeNowSeconds * 1000);
      const millis = getTimeToExpiredMilliseconds(validUntilSeconds);

      expect(millis).toBe(0);
    });
  });

  describe('isRequestExpiredByLocalClock()', () => {
    it('returns true if provided request timestamp (in seconds) is lower than local unix timestamp', () => {
      const timeNowSeconds = 90;
      const validUntilSeconds = 100;

      global.Date.now = vi.fn().mockReturnValue(timeNowSeconds * 1000);
      expect(isRequestExpiredByLocalClock(validUntilSeconds)).toBe(false);
    });
    it('returns false if provided request timestamp is higher than local unix timestamp', () => {
      const timeNowSeconds = 110;
      const validUntilSeconds = 100;

      global.Date.now = vi.fn().mockReturnValue(timeNowSeconds * 1000);
      expect(isRequestExpiredByLocalClock(validUntilSeconds)).toBe(true);
    });
  });

  describe('isRequestExpiredByLatestBlock()', () => {
    it('returns true when request is considered expired by latest block', async () => {
      const validUntilSeconds = 100;
      const blockTimestampSeconds = 120;

      mockGetLatestBlock({
        timestamp: blockTimestampSeconds,
      });

      const validityExpired = await isRequestExpiredByLatestBlock(validUntilSeconds, RPC_URL);

      expect(validityExpired).toBe(true);
    });
    it('returns false when request is considered active by comparing to latest block timestamp', async () => {
      const validUntilSeconds = 100;
      const blockTimestampSeconds = 80;

      mockGetLatestBlock({
        timestamp: blockTimestampSeconds,
      });

      const validityExpired = await isRequestExpiredByLatestBlock(validUntilSeconds, RPC_URL);

      expect(validityExpired).toBe(false);
    });
  });

  describe('isRequestClaimed()', () => {
    it('returns true if claim count is not 0', () => {
      expect(isRequestClaimed(3)).toBe(true);
    });
    it('returns false if claim count is 0', () => {
      expect(isRequestClaimed(0)).toBe(false);
    });
  });

  describe('listenOnClaimCountChange()', () => {
    it('attaches a callback handler for claim count increase', () => {
      const onIncrease = vi.fn();
      const requestIdentifier = getRandomString();
      const options = {
        rpcUrl: getRandomUrl('rpc'),
        requestManagerAddress: getRandomString(),
        requestIdentifier,
        onReduce: vi.fn(),
        onIncrease,
      };

      const contract = mockGetRequestManagerContract();
      contract.filters.ClaimMade = vi.fn().mockReturnValue('test-filter');
      contract.filters.ClaimStakeWithdrawn = vi.fn();

      listenOnClaimCountChange(options);

      expect(contract.filters.ClaimMade).toHaveBeenCalledWith(requestIdentifier);
      expect(contract.on).toHaveBeenCalledWith('test-filter', onIncrease);
    });

    it('attaches a callback handler for claim count decrease', () => {
      const onReduce = vi.fn();
      const requestIdentifier = getRandomString();
      const options = {
        rpcUrl: getRandomUrl('rpc'),
        requestManagerAddress: getRandomString(),
        requestIdentifier,
        onReduce,
        onIncrease: vi.fn(),
      };

      const contract = mockGetRequestManagerContract();
      contract.filters.ClaimMade = vi.fn();
      contract.filters.ClaimStakeWithdrawn = vi.fn().mockReturnValue('test-filter');

      listenOnClaimCountChange(options);
      expect(contract.filters.ClaimStakeWithdrawn).toHaveBeenCalledWith(
        undefined,
        requestIdentifier,
      );

      expect(contract.on).toHaveBeenCalledWith('test-filter', onReduce);
    });
  });

  describe('waitUntilClaimsWithdrawn()', () => {
    it('listens to `ClaimStakeWithdrawn` event until request has 0 active claims', async () => {
      let activeClaimCount = 3;
      const requestIdentifier = getRandomString();

      const contract = mockGetRequestManagerContract();
      contract.filters.ClaimStakeWithdrawn = vi.fn().mockReturnValue('test-filter');
      contract.on = vi.fn().mockImplementation((_, callback) => {
        while (activeClaimCount-- > 0) {
          callback();
        }
      });

      const { promise } = waitUntilClaimsWithdrawn(
        RPC_URL,
        REQUEST_MANAGER_ADDRESS,
        requestIdentifier,
        activeClaimCount,
      );

      expect(contract.filters.ClaimStakeWithdrawn).toHaveBeenLastCalledWith(
        undefined,
        requestIdentifier,
      );
      expect(contract.on).toHaveBeenCalledWith('test-filter', expect.anything());
      await expect(promise).resolves.toBeUndefined();
    });

    it('instantly resolves if provided active claim count is 0', async () => {
      const activeClaimCount = 0;
      const requestIdentifier = getRandomString();
      mockGetRequestManagerContract();

      const { promise } = waitUntilClaimsWithdrawn(
        RPC_URL,
        REQUEST_MANAGER_ADDRESS,
        requestIdentifier,
        activeClaimCount,
      );

      await expect(promise).resolves.toBeUndefined();
    });

    describe('cancel()', () => {
      it('can be executed in order to stop listening for events', () => {
        const requestIdentifier = getRandomString();
        const activeClaimCount = 1;
        const contract = mockGetRequestManagerContract();
        contract.removeAllListeners = vi.fn();

        const { cancel } = waitUntilClaimsWithdrawn(
          RPC_URL,
          REQUEST_MANAGER_ADDRESS,
          requestIdentifier,
          activeClaimCount,
        );

        cancel();
        expect(contract.removeAllListeners).toHaveBeenCalledOnce();
      });
    });
  });

  describe('failWhenRequestExpires()', () => {
    beforeEach(() => {
      const provider = mockGetProvider();
      provider.removeAllListeners = vi.fn();
      provider.once = vi.fn();

      global.Date.now = vi.fn().mockReturnValue(getRandomNumber());

      vi.useFakeTimers();
      vi.spyOn(global, 'setTimeout');
    });

    describe('when request expired both by local & sequencer clock', () => {
      const localClockTimestampSeconds = 1001;
      const localClockTimestampMilliseconds = localClockTimestampSeconds * 1000;
      const blockTimestampSeconds = 1001;
      const validUntilSeconds = 1000;

      it('waits until all claims are withdrawn', async () => {
        const activeClaims = 2;
        global.Date.now = vi.fn().mockReturnValue(localClockTimestampMilliseconds);

        const contract = mockGetRequestManagerContract();
        contract.requests = vi.fn().mockReturnValue(
          new MockedRequest({
            validUntil: validUntilSeconds,
            activeClaims,
          }),
        );
        contract.filters.ClaimStakeWithdrawn = vi.fn().mockReturnValue('fake-filter');

        mockGetLatestBlock({
          timestamp: blockTimestampSeconds,
        });

        failWhenRequestExpires(RPC_URL, REQUEST_MANAGER_ADDRESS, DEFAULT_REQUEST_IDENTIFIER);

        await flushPromises();

        expect(contract.on).toHaveBeenCalledWith('fake-filter', expect.anything());
      });

      it('rejects if all claims are withdrawn', async () => {
        const activeClaims = 0;
        global.Date.now = vi.fn().mockReturnValue(localClockTimestampMilliseconds);

        const contract = mockGetRequestManagerContract();
        contract.requests = vi.fn().mockReturnValue(
          new MockedRequest({
            validUntil: validUntilSeconds,
            activeClaims,
          }),
        );

        mockGetLatestBlock({
          timestamp: blockTimestampSeconds,
        });

        const { promise } = failWhenRequestExpires(
          RPC_URL,
          REQUEST_MANAGER_ADDRESS,
          DEFAULT_REQUEST_IDENTIFIER,
        );

        await expect(promise).rejects.toThrowError('Request has expired!');
      });
    });

    describe("when request haven't expired by both local clock & sequencer clock", () => {
      it('sleeps until request is expected to be expired by local clock', async () => {
        const localClockTimestampSeconds = 999;
        const localClockTimestampMilliseconds = localClockTimestampSeconds * 1000;
        const blockTimestampSeconds = 999;
        const validUntilSeconds = 1000;

        global.Date.now = vi.fn().mockReturnValue(localClockTimestampMilliseconds);

        const contract = mockGetRequestManagerContract();
        contract.requests = vi.fn().mockReturnValue(
          new MockedRequest({
            validUntil: validUntilSeconds,
          }),
        );

        mockGetLatestBlock({
          timestamp: blockTimestampSeconds,
        });

        failWhenRequestExpires(RPC_URL, REQUEST_MANAGER_ADDRESS, DEFAULT_REQUEST_IDENTIFIER);
        await flushPromises();

        const expectedSleepUntilMilliseconds =
          (validUntilSeconds - localClockTimestampSeconds) * 1000;

        expect(setTimeout).toHaveBeenCalledWith(expect.anything(), expectedSleepUntilMilliseconds);
      });
    });

    describe('when request expired by local clock but not expired by sequencer clock', () => {
      it('waits for the next block', async () => {
        const localClockTimestampSeconds = 1001;
        const localClockTimestampMilliseconds = localClockTimestampSeconds * 1000;
        const blockTimestampSeconds = 999;
        const validUntilSeconds = 1000;

        global.Date.now = vi.fn().mockReturnValue(localClockTimestampMilliseconds);

        const contract = mockGetRequestManagerContract();
        contract.requests = vi.fn().mockReturnValue(
          new MockedRequest({
            validUntil: validUntilSeconds,
          }),
        );

        const provider = mockGetProvider();
        provider.once = vi.fn();

        mockGetLatestBlock({
          timestamp: blockTimestampSeconds,
        });

        failWhenRequestExpires(RPC_URL, REQUEST_MANAGER_ADDRESS, DEFAULT_REQUEST_IDENTIFIER);
        await flushPromises();

        expect(provider.once).toHaveBeenCalledWith('block', expect.anything());
      });
    });

    describe('cancel()', () => {
      it('can be executed in order to stop listening for events', () => {
        const contract = mockGetRequestManagerContract();
        contract.requests = vi.fn().mockReturnValue(new MockedRequest());

        const provider = mockGetProvider();
        provider.removeAllListeners = vi.fn();

        const { cancel } = failWhenRequestExpires(
          RPC_URL,
          REQUEST_MANAGER_ADDRESS,
          DEFAULT_REQUEST_IDENTIFIER,
        );

        cancel();
        expect(provider.removeAllListeners).toHaveBeenCalled();
      });
    });
  });

  describe('withdrawRequest()', () => {
    it('makes an attempt to withdraw the tokens that were sent in a specific request', async () => {
      const requestIdentifier = getRandomString();
      const gasLimit = '1';

      const contract = mockGetRequestManagerContract();
      contract.estimateGas.withdrawExpiredRequest = vi.fn().mockReturnValue(gasLimit);
      contract.withdrawExpiredRequest = vi.fn().mockReturnValue(new MockedTransaction());

      SIGNER.getChainId = vi.fn().mockReturnValue(1);

      await withdrawRequest(ETHEREUM_PROVIDER, REQUEST_MANAGER_ADDRESS, requestIdentifier);

      expect(contract.estimateGas.withdrawExpiredRequest).toHaveBeenCalledWith(requestIdentifier);
      expect(contract.withdrawExpiredRequest).toHaveBeenCalledWith(requestIdentifier, {
        gasLimit,
      });
    });

    it('throws an exception when a transfer withdrawal transaction failed', async () => {
      const requestIdentifier = getRandomString();

      const contract = mockGetRequestManagerContract();
      contract.withdrawExpiredRequest = vi.fn().mockImplementation(() => {
        throw new Error('transaction failed');
      });

      await expect(
        withdrawRequest(ETHEREUM_PROVIDER, REQUEST_MANAGER_ADDRESS, requestIdentifier),
      ).rejects.toThrow('transaction failed');
    });
  });
});
