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
