export class MockedBigNumber {
  constructor(public value: string) {}

  from = vi.fn().mockImplementation((value: string) => new MockedBigNumber(value));
  toString = vi.fn().mockImplementation(() => this.value);
  isNegative = vi.fn();
  lt = vi.fn();
  isZero = vi.fn();
}

export class MockedTransaction {
  wait = vi.fn();
}

export class MockedTransactionReceipt {
  logs = [];
  status = 1;

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
