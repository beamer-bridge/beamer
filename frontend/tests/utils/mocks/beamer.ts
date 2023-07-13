import { getRandomNumber } from '~/utils/data_generators';
import { MockedBigNumber, MockedTransaction } from '~/utils/mocks/ethers';

export class MockedToken {
  readonly transferLimit: MockedBigNumber;

  constructor(options?: { transferLimit?: string }) {
    this.transferLimit = new MockedBigNumber(
      options?.transferLimit ?? getRandomNumber().toString(),
    );
  }
}
export class MockedRequest {
  readonly validUntil: number;
  readonly activeClaims: number;
  readonly withdrawClaimId: MockedBigNumber;

  constructor(options?: { validUntil?: number; activeClaims?: number; withdrawClaimId?: number }) {
    this.validUntil = options?.validUntil ?? getRandomNumber();
    this.activeClaims = options?.activeClaims ?? getRandomNumber();
    this.withdrawClaimId = new MockedBigNumber(
      options?.withdrawClaimId?.toString() ?? getRandomNumber().toString(),
    );
  }
}

export class MockedRequestManagerContract {
  totalFee = vi.fn();
  requests = vi.fn();
  transferableAmount = vi.fn();
  minLpFee = vi.fn();
  tokens = vi.fn().mockReturnValue(() => new MockedToken());

  createRequest = vi.fn().mockImplementation(() => new MockedTransaction());
  withdrawExpiredRequest = vi.fn().mockImplementation(() => new MockedTransaction());

  estimateGas = {
    createRequest: vi.fn(),
    withdrawExpiredRequest: vi.fn(),
  };

  filters = {
    ClaimStakeWithdrawn: vi.fn(),
    ClaimMade: vi.fn(),
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
export class MockedFeeSubContract {
  tokenAmountCanBeSubsidized = vi.fn();
  minimumAmounts = vi.fn();
}
