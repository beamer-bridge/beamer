export function createMockedFocusOnMountDirective(options?: {
  mounted: (...args: unknown[]) => unknown;
}) {
  return {
    mounted: options?.mounted ?? vi.fn(),
  };
}
