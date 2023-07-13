import { getRandomTransactionHash } from '../data_generators';

export class MockedBigNumber {
  constructor(public value: string) {}

  from = vi.fn().mockImplementation((value: string) => new MockedBigNumber(value));
  toString = vi.fn().mockImplementation(() => this.value);
  isNegative = vi.fn();
  lt = vi.fn();
  gt = vi.fn();
  isZero = vi.fn();
}

export class MockedTransaction {
  wait = vi.fn();
}

export class MockedTransactionReceipt {
  logs: string[] = [];
  status = 1;
  blockHash = '0x123';
  transactionHash = getRandomTransactionHash();

  constructor(public props: Partial<MockedTransactionReceipt> = {}) {
    Object.assign(this, props);
  }
}

export class MockedERC20TokenContract {
  allowance = vi.fn();
  approve = vi.fn().mockImplementation(() => new MockedTransaction());
  balanceOf = vi.fn();

  filters = {
    Transfer: vi.fn(),
  };

  on = vi.fn();
}

export class MockedEvent {
  removed = 0;
  transactionHash?: string;

  constructor(public props: Partial<MockedEvent> = {}) {
    Object.assign(this, props);
  }
}

export class MockedBlock {
  hash = '0x123';
  timestamp = 100;

  constructor(public props: Partial<MockedBlock> = {}) {
    Object.assign(this, props);
  }
}
