import { JsonRpcProvider, JsonRpcSigner } from '@ethersproject/providers';
import { flushPromises } from '@vue/test-utils';

import {
  failWhenRequestExpires,
  getAmountBeforeFees,
  getMinRequestFee,
  getRequestData,
  getRequestFee,
  getRequestIdentifier,
  getTimeToExpiredMilliseconds,
  getTransferLimit,
  isRequestClaimed,
  isRequestExpiredByLatestBlock,
  isRequestExpiredByLocalClock,
  sendRequestTransaction,
  waitUntilClaimsWithdrawn,
  withdrawRequest,
} from '@/services/transactions/request-manager';
import * as transactionUtils from '@/services/transactions/utils';
import { UInt256 } from '@/types/uint-256';
import {
  getRandomEthereumAddress,
  getRandomNumber,
  getRandomString,
  getRandomUrl,
} from '~/utils/data_generators';
import { MockedRequest, MockedRequestManagerContract } from '~/utils/mocks/beamer';
import {
  MockedBigNumber,
  MockedTransaction,
  MockedTransactionReceipt,
} from '~/utils/mocks/ethers';

vi.mock('@/services/transactions/utils');
vi.mock('@ethersproject/providers');

const PARTS_IN_PERCENT = 100;
const PARTS_IN_MILLION = 1000000;

const REQUEST_MANAGER_ADDRESS = getRandomEthereumAddress();
const RPC_URL = getRandomUrl('rpc');
const PROVIDER = new JsonRpcProvider();
const SIGNER = new JsonRpcSigner(undefined, PROVIDER);
const DEFAULT_REQUEST_IDENTIFIER = '1';

function mockGetLatestBlock(options?: { timestamp?: number }) {
  Object.defineProperties(transactionUtils, {
    getLatestBlock: {
      value: vi.fn().mockReturnValue({
        timestamp: options?.timestamp ?? 1,
      }),
    },
  });
}

function mockGetProvider() {
  const provider = new JsonRpcProvider();

  Object.defineProperties(transactionUtils, {
    getJsonRpcProvider: {
      value: vi.fn().mockReturnValue(provider),
    },
  });

  return provider;
}

function mockGetContract(options?: {
  minLpFeeWei?: string;
  lpFeePartsPerMillion?: string;
  protocolFeePartsPerMillion?: string;
  totalFee?: string;
  transferLimit?: string;
}) {
  const contract = new MockedRequestManagerContract();

  contract.minLpFee = vi.fn().mockReturnValue(new MockedBigNumber(options?.minLpFeeWei ?? '0'));
  contract.lpFeePPM = vi
    .fn()
    .mockReturnValue(new MockedBigNumber(options?.lpFeePartsPerMillion ?? '0'));
  contract.protocolFeePPM = vi
    .fn()
    .mockReturnValue(new MockedBigNumber(options?.protocolFeePartsPerMillion ?? '0'));
  contract.transferLimit = vi
    .fn()
    .mockReturnValue(new MockedBigNumber(options?.transferLimit ?? '0'));
  contract.totalFee = vi.fn().mockReturnValue(new MockedBigNumber(options?.totalFee ?? '0'));

  Object.defineProperties(transactionUtils, {
    getReadOnlyContract: {
      value: vi.fn().mockReturnValue(contract),
    },
    getReadWriteContract: {
      value: vi.fn().mockReturnValue(contract),
    },
  });

  return contract;
}

function transformPercentToPPM(percent: number): string {
  return (percent * (PARTS_IN_MILLION / PARTS_IN_PERCENT)).toString();
}

describe('request-manager', () => {
  beforeEach(() => {
    global.console.error = vi.fn();
    global.Date.now = vi.fn();

    mockGetContract();
    mockGetLatestBlock();
    mockGetProvider();
  });
  describe('getTransferLimit()', () => {
    it('returns the transfer limit amount', async () => {
      mockGetContract({
        transferLimit: '100',
      });

      const transferLimit = await getTransferLimit(RPC_URL, REQUEST_MANAGER_ADDRESS);

      expect(transferLimit.asString).toBe('100');
    });
  });
  describe('getAmountBeforeFees()', () => {
    describe('when percentage lp fee is higher than the minimal lp fee for the provided token amount', () => {
      it('returns the amount before fees for the provided total amount by using percentage fees', async () => {
        const DECIMALS = 4;

        const minLpFee = 0.001;
        const lpFeePercent = 0.3;
        const protocolFeePercent = 0.3;

        const minLpFeeWei = UInt256.parse(minLpFee.toString(), DECIMALS);
        const lpFeePartsPerMillion = new UInt256(transformPercentToPPM(lpFeePercent));
        const protocolFeePartsPerMillion = new UInt256(transformPercentToPPM(protocolFeePercent));

        mockGetContract({
          minLpFeeWei: minLpFeeWei.asString,
          lpFeePartsPerMillion: lpFeePartsPerMillion.asString,
          protocolFeePartsPerMillion: protocolFeePartsPerMillion.asString,
        });

        const totalAmounts = [
          UInt256.parse('10', DECIMALS),
          UInt256.parse('100', DECIMALS),
          UInt256.parse('1000', DECIMALS),
        ];
        const expectedResult = [
          new UInt256('99403'),
          new UInt256('994035'),
          new UInt256('9940357'),
        ];
        const testCases = [
          [totalAmounts[0], expectedResult[0]],
          [totalAmounts[1], expectedResult[1]],
          [totalAmounts[2], expectedResult[2]],
        ];

        testCases.forEach(async ([amount, expectedResult]) => {
          const result = await getAmountBeforeFees(amount, RPC_URL, REQUEST_MANAGER_ADDRESS);
          expect(result.asString).toBe(expectedResult.asString);
        });
      });
    });
    describe('when percentage lp fee is lower than the minimal lp fee for the provided token amount', () => {
      it('throws an exception when the base amount goes in the negative number range', async () => {
        const DECIMALS = 0;

        const totalAmountDecimal = 1;
        const minLpFee = 2;
        const lpFeePercent = 0.3;

        const totalAmountWei = UInt256.parse(totalAmountDecimal.toString(), DECIMALS);
        const minLpFeeWei = UInt256.parse(minLpFee.toString(), DECIMALS);
        const lpFeePartsPerMillion = new UInt256(transformPercentToPPM(lpFeePercent));

        mockGetContract({
          minLpFeeWei: minLpFeeWei.asString,
          lpFeePartsPerMillion: lpFeePartsPerMillion.asString,
        });

        expect(
          getAmountBeforeFees(totalAmountWei, RPC_URL, REQUEST_MANAGER_ADDRESS),
        ).rejects.toThrow('Total amount is not high enough to cover the fees.');
      });

      it('returns the amount before fees for the provided total amount by using protocol percentage fee & minimal lp fee in units', async () => {
        const DECIMALS = 4;

        const minLpFee = 1;
        const lpFeePercent = 0.003;
        const protocolFeePercent = 0.3;

        const minLpFeeWei = UInt256.parse(minLpFee.toString(), DECIMALS);
        const lpFeePartsPerMillion = new UInt256(transformPercentToPPM(lpFeePercent));
        const protocolFeePartsPerMillion = new UInt256(transformPercentToPPM(protocolFeePercent));

        mockGetContract({
          minLpFeeWei: minLpFeeWei.asString,
          lpFeePartsPerMillion: lpFeePartsPerMillion.asString,
          protocolFeePartsPerMillion: protocolFeePartsPerMillion.asString,
        });

        const totalAmounts = [
          UInt256.parse('10', DECIMALS),
          UInt256.parse('100', DECIMALS),
          UInt256.parse('1000', DECIMALS),
        ];
        const expectedResult = [
          new UInt256('89700'),
          new UInt256('987008'),
          new UInt256('9960089'),
        ];
        const testCases = [
          [totalAmounts[0], expectedResult[0]],
          [totalAmounts[1], expectedResult[1]],
          [totalAmounts[2], expectedResult[2]],
        ];

        testCases.forEach(async ([amount, expectedResult]) => {
          const result = await getAmountBeforeFees(amount, RPC_URL, REQUEST_MANAGER_ADDRESS);
          expect(result.asString).toBe(expectedResult.asString);
        });
      });
    });
  });

  describe('getMinRequestFee()', () => {
    it('returns the minimum request fee', async () => {
      mockGetContract({
        minLpFeeWei: '100',
      });

      const transferLimit = await getMinRequestFee(RPC_URL, REQUEST_MANAGER_ADDRESS);

      expect(transferLimit.asString).toBe('100');
    });
  });

  describe('getRequestFee()', () => {
    it('returns the calculated fee for the provided token amount', async () => {
      const transferAmount = new UInt256('100');

      mockGetContract({
        totalFee: '50',
      });

      const transferLimit = await getRequestFee(RPC_URL, REQUEST_MANAGER_ADDRESS, transferAmount);

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
      const contract = mockGetContract();
      const estimatedGas = '100';
      contract.estimateGas.createRequest = vi.fn().mockReturnValue(estimatedGas);

      await sendRequestTransaction(
        SIGNER,
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
      const contract = mockGetContract();

      contract.createRequest = vi.fn().mockImplementation(() => {
        throw new Error('transaction failed');
      });

      expect(
        sendRequestTransaction(
          SIGNER,
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

  describe('getRequestIdentifier()', async () => {
    it('queries and returns the request identifier for a given transaction hash', async () => {
      const transactionHash = getRandomString();

      const contract = mockGetContract();
      contract.interface.parseLog = vi.fn().mockReturnValue({ args: { requestId: '1' } });

      const provider = mockGetProvider();
      provider.waitForTransaction = vi.fn().mockReturnValue(new MockedTransactionReceipt());

      const identifier = await getRequestIdentifier(
        RPC_URL,
        REQUEST_MANAGER_ADDRESS,
        transactionHash,
      );

      expect(provider.waitForTransaction).toHaveBeenCalledWith(transactionHash, expect.anything());
      expect(identifier).toBe('1');
    });

    it('throws an error when the given transaction hash cannot be resolved to a request identifier', async () => {
      const transactionHash = getRandomString();

      const provider = mockGetProvider();
      provider.waitForTransaction = vi.fn().mockReturnValue(null);

      expect(
        getRequestIdentifier(RPC_URL, REQUEST_MANAGER_ADDRESS, transactionHash),
      ).rejects.toThrow("Request Failed. Couldn't retrieve Request ID");
    });
  });

  describe('getRequestData()', async () => {
    it('returns the transfer request that corresponds to the provided request id', async () => {
      const requestIdentifier = getRandomString();
      const request = new MockedRequest();
      const contract = mockGetContract();
      contract.requests = vi.fn().mockReturnValue(request);

      const response = await getRequestData(RPC_URL, REQUEST_MANAGER_ADDRESS, requestIdentifier);

      expect(response).not.toBeUndefined();
      expect(Object.keys(response)).toEqual([
        'validUntil',
        'activeClaims',
        'withdrawClaimId',
        'withdrawn',
      ]);
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
      const validUntilSeconds = new UInt256('100');

      global.Date.now = vi.fn().mockReturnValue(timeNowSeconds * 1000);
      const millis = getTimeToExpiredMilliseconds(validUntilSeconds);

      expect(millis).toBe(10_000);
    });
    it('returns 0 if the provided validity timestamp is in the past', () => {
      const timeNowSeconds = 110;
      const validUntilSeconds = new UInt256('100');

      global.Date.now = vi.fn().mockReturnValue(timeNowSeconds * 1000);
      const millis = getTimeToExpiredMilliseconds(validUntilSeconds);

      expect(millis).toBe(0);
    });
  });

  describe('isRequestExpiredByLocalClock()', () => {
    it('returns true if provided request timestamp (in seconds) is lower than local unix timestamp', () => {
      const timeNowSeconds = 90;
      const validUntilSeconds = new UInt256('100');

      global.Date.now = vi.fn().mockReturnValue(timeNowSeconds * 1000);
      expect(isRequestExpiredByLocalClock(validUntilSeconds)).toBe(false);
    });
    it('returns false if provided request timestamp is higher than local unix timestamp', () => {
      const timeNowSeconds = 110;
      const validUntilSeconds = new UInt256('100');

      global.Date.now = vi.fn().mockReturnValue(timeNowSeconds * 1000);
      expect(isRequestExpiredByLocalClock(validUntilSeconds)).toBe(true);
    });
  });

  describe('isRequestExpiredByLatestBlock()', () => {
    it('returns true when request is considered expired by latest block', async () => {
      const validUntilSeconds = new UInt256('100');
      const blockTimestampSeconds = 120;

      mockGetLatestBlock({
        timestamp: blockTimestampSeconds,
      });

      const validityExpired = await isRequestExpiredByLatestBlock(validUntilSeconds, RPC_URL);

      expect(validityExpired).toBe(true);
    });
    it('returns false when request is considered active by comparing to latest block timestamp', async () => {
      const validUntilSeconds = new UInt256('100');
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
      expect(isRequestClaimed(new UInt256('3'))).toBe(true);
    });
    it('returns false if claim count is 0', () => {
      expect(isRequestClaimed(new UInt256('0'))).toBe(false);
    });
  });

  describe('waitUntilClaimsWithdrawn()', () => {
    it('listens to `ClaimStakeWithdrawn` event until request has 0 active claims', async () => {
      let activeClaimCount = 3;
      const requestIdentifier = getRandomString();

      const contract = mockGetContract();
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
      mockGetContract();

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
        const contract = mockGetContract();
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

        const contract = mockGetContract();
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

        const contract = mockGetContract();
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

        const contract = mockGetContract();
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

        const contract = mockGetContract();
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
        const contract = mockGetContract();
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

      const contract = mockGetContract();
      contract.estimateGas.withdrawExpiredRequest = vi.fn().mockReturnValue(gasLimit);
      contract.withdrawExpiredRequest = vi.fn().mockReturnValue(new MockedTransaction());

      await withdrawRequest(SIGNER, REQUEST_MANAGER_ADDRESS, requestIdentifier);

      expect(contract.estimateGas.withdrawExpiredRequest).toHaveBeenCalledWith(requestIdentifier);
      expect(contract.withdrawExpiredRequest).toHaveBeenCalledWith(requestIdentifier, {
        gasLimit,
      });
    });

    it('throws an exception when a transfer withdrawal transaction failed', async () => {
      const requestIdentifier = getRandomString();

      const contract = mockGetContract();
      contract.withdrawExpiredRequest = vi.fn().mockImplementation(() => {
        throw new Error('transaction failed');
      });

      await expect(
        withdrawRequest(SIGNER, REQUEST_MANAGER_ADDRESS, requestIdentifier),
      ).rejects.toThrow('transaction failed');
    });
  });
});
