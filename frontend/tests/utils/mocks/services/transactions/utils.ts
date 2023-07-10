import { JsonRpcProvider } from '@ethersproject/providers';

import * as transactionUtils from '@/services/transactions/utils';
import {
  MockedFeeSubContract,
  MockedFillManagerContract,
  MockedRequestManagerContract,
} from '~/utils/mocks/beamer';
import { MockedERC20TokenContract } from '~/utils/mocks/ethers';

export function mockGetSafeEventHandler() {
  Object.defineProperties(transactionUtils, {
    getSafeEventHandler: {
      value: vi.fn().mockImplementation((handler) => handler),
    },
  });
}

export function mockGetLatestBlock(options?: { timestamp?: number }) {
  Object.defineProperties(transactionUtils, {
    getLatestBlock: {
      value: vi.fn().mockReturnValue({
        timestamp: options?.timestamp ?? 1,
      }),
    },
  });
}

export function mockGetProvider() {
  const provider = new JsonRpcProvider();
  provider.getNetwork = vi.fn().mockResolvedValue({ chainId: 1 });
  Object.defineProperties(transactionUtils, {
    getJsonRpcProvider: {
      value: vi.fn().mockReturnValue(provider),
    },
  });

  return provider;
}

export function mockGetERC20Contract() {
  const contract = new MockedERC20TokenContract();

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

export function mockGetRequestManagerContract() {
  const contract = new MockedRequestManagerContract();

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

export function mockGetFillManagerContract() {
  const contract = new MockedFillManagerContract();

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
export function mockGetFeeSubContract() {
  const contract = new MockedFeeSubContract();

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
