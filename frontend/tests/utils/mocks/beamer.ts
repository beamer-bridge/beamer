export class MockedFillManagerContract {
  filters = {
    RequestFilled: vi.fn(),
  };
  on = vi.fn();
  removeAllListeners = vi.fn();
}
