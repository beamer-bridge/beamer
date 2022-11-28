import { getRandomNumber } from '~/utils/data_generators';
import { MockedBigNumber, MockedTransaction } from '~/utils/mocks/ethers';

export class MockedRequest {
  readonly validUntil: MockedBigNumber;
  readonly activeClaims: MockedBigNumber;
  readonly withdrawClaimId: MockedBigNumber;

  constructor(options?: { validUntil?: number; activeClaims?: number; withdrawClaimId?: number }) {
    this.validUntil = new MockedBigNumber(
      options?.validUntil?.toString() ?? getRandomNumber().toString(),
    );
    this.activeClaims = new MockedBigNumber(
      options?.activeClaims?.toString() ?? getRandomNumber().toString(),
    );
    this.withdrawClaimId = new MockedBigNumber(
      options?.withdrawClaimId?.toString() ?? getRandomNumber().toString(),
    );
  }
}

export class MockedRequestManagerContract {
  transferLimit = vi.fn();
  minLpFee = vi.fn();
  lpFeePPM = vi.fn();
  protocolFeePPM = vi.fn();
  totalFee = vi.fn();
  requests = vi.fn();

  createRequest = vi.fn().mockImplementation(() => new MockedTransaction());
  withdrawExpiredRequest = vi.fn().mockImplementation(() => new MockedTransaction());
  estimateGas = {
    createRequest: vi.fn(),
    withdrawExpiredRequest: vi.fn(),
  };

  filters = {
    ClaimStakeWithdrawn: vi.fn(),
  };

  interface = {
    parseLog: vi.fn(),
  };

  on = vi.fn();
  removeAllListeners = vi.fn();
}
export class MockedFillManagerContract {
  filters = {
    RequestFilled: vi.fn(),
  };
  on = vi.fn();
  removeAllListeners = vi.fn();
}
