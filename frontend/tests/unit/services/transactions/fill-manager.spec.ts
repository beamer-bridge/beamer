import { flushPromises } from '@vue/test-utils';

import * as eventFiltersService from '@/services/events/filter-utils';
import {
  fetchPastFulfillmentEvent,
  waitForFulfillment,
} from '@/services/transactions/fill-manager';
import * as transactionUtils from '@/services/transactions/utils';
import {
  getRandomEthereumAddress,
  getRandomNumber,
  getRandomString,
  getRandomUrl,
} from '~/utils/data_generators';
import { MockedEvent } from '~/utils/mocks/ethers';
import { mockGetFillManagerContract } from '~/utils/mocks/services/transactions/utils';

vi.mock('@/services/transactions/utils');
vi.mock('ethers');
vi.mock('@/services/events/filters');

function createConfig(options?: {
  rpcUrl?: string;
  fillManagerAddress?: string;
  requestIdentifier?: string;
  fromBlockNumber?: number;
}) {
  return {
    rpcUrl: options?.rpcUrl ?? getRandomUrl('rpc'),
    fillManagerAddress: options?.fillManagerAddress ?? getRandomEthereumAddress(),
    requestIdentifier: options?.requestIdentifier ?? getRandomString(),
    fromBlockNumber: options?.fromBlockNumber ?? getRandomNumber(),
  };
}

describe('fill-manager', () => {
  beforeEach(() => {
    mockGetFillManagerContract();

    Object.defineProperty(transactionUtils, 'getCurrentBlockNumber', {
      value: vi.fn(),
    });

    Object.defineProperty(eventFiltersService, 'fetchFirstMatchingEvent', {
      value: vi.fn(),
    });
  });

  describe('fetchPastFulfillmentEvent()', () => {
    it('calls fetchFirstMatchingEvent with the right parameters', async () => {
      const { rpcUrl, fillManagerAddress, requestIdentifier, fromBlockNumber } = createConfig({
        fromBlockNumber: 1,
      });

      const toBlockNumber = 10;

      const contract = mockGetFillManagerContract();
      const filter = 'fake-filter';
      contract.filters.RequestFilled = vi.fn().mockReturnValue(filter);

      Object.defineProperty(transactionUtils, 'getCurrentBlockNumber', {
        value: vi.fn().mockReturnValue(toBlockNumber),
      });

      await fetchPastFulfillmentEvent(
        rpcUrl,
        fillManagerAddress,
        requestIdentifier,
        fromBlockNumber,
      );

      expect(eventFiltersService.fetchFirstMatchingEvent).toHaveBeenNthCalledWith(
        1,
        contract,
        filter,
        fromBlockNumber,
        toBlockNumber,
      );
    });
    it('returns the result from the event filter operation', async () => {
      const { rpcUrl, fillManagerAddress, requestIdentifier, fromBlockNumber } = createConfig();

      const event = new MockedEvent();
      Object.defineProperty(eventFiltersService, 'fetchFirstMatchingEvent', {
        value: vi.fn().mockResolvedValue(event),
      });

      await expect(
        fetchPastFulfillmentEvent(rpcUrl, fillManagerAddress, requestIdentifier, fromBlockNumber),
      ).resolves.toBe(event);
    });
  });

  describe('waitForFulfillment()', () => {
    it('initiates the awaitable operation for finding a fulfillment event', async () => {
      const { rpcUrl, fillManagerAddress, requestIdentifier, fromBlockNumber } = createConfig();

      const contract = mockGetFillManagerContract();

      waitForFulfillment(rpcUrl, fillManagerAddress, requestIdentifier, fromBlockNumber);
      await flushPromises();

      expect(contract.on).toHaveBeenCalled();
      expect(eventFiltersService.fetchFirstMatchingEvent).toHaveBeenCalled();
      expect(contract.removeAllListeners).not.toHaveBeenCalled();
    });

    it('resolves & stops listening for fulfillment events when a matching event was found', async () => {
      const { rpcUrl, fillManagerAddress, requestIdentifier, fromBlockNumber } = createConfig();

      const contract = mockGetFillManagerContract();

      const event = new MockedEvent();
      Object.defineProperty(eventFiltersService, 'fetchFirstMatchingEvent', {
        value: vi.fn().mockResolvedValue(event),
      });
      const timestamp = 100;
      Object.defineProperty(transactionUtils, 'getBlockTimestamp', {
        value: vi.fn().mockResolvedValue(timestamp),
      });

      const { promise } = waitForFulfillment(
        rpcUrl,
        fillManagerAddress,
        requestIdentifier,
        fromBlockNumber,
      );

      await expect(promise).resolves.toBe(timestamp);
      expect(contract.removeAllListeners).toHaveBeenCalled();
    });

    describe('cancel()', () => {
      it('can be executed in order to stop listening for fulfillment events', () => {
        const { rpcUrl, fillManagerAddress, requestIdentifier, fromBlockNumber } = createConfig();

        const contract = mockGetFillManagerContract();

        const { cancel } = waitForFulfillment(
          rpcUrl,
          fillManagerAddress,
          requestIdentifier,
          fromBlockNumber,
        );

        expect(contract.on).toHaveBeenCalled();

        cancel();

        expect(contract.removeAllListeners).toHaveBeenCalled();
      });
    });
  });
});
