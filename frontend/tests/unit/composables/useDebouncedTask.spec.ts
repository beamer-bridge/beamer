import { useDebouncedTask } from '@/composables/useDebouncedTask';

const delayInMillis = 500;

describe('useDebouncedTask', () => {
  it('returns a wrapper function', () => {
    const result = useDebouncedTask(vi.fn(), delayInMillis);
    expect(result).toBeTypeOf('function');
  });

  describe('returned wrapper function', () => {
    it('on call should forward the call to the provided callback', async () => {
      const callback = vi.fn();
      const wrapper = useDebouncedTask(callback, delayInMillis);

      wrapper();
      expect(callback).not.toHaveBeenCalled();
      await new Promise((r) => setTimeout(r, delayInMillis));
      expect(callback).toHaveBeenCalledOnce();
    });
  });
});
