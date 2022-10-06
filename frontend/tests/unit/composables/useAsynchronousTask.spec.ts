import { flushPromises } from '@vue/test-utils';

import { useAsynchronousTask } from '@/composables/useAsynchronousTask';

describe('useAsynchronousTask', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  it('wraps the provided callback function in an async function', async () => {
    const fn = vi.fn();
    const { run } = useAsynchronousTask(fn);

    expect(run).toBeTypeOf('function');

    expect(run().then).toBeDefined();

    await flushPromises();

    expect(fn).toHaveBeenCalled();
  });

  it('provides feedback on callback execution error', async () => {
    const fn = () => {
      throw new Error('error message');
    };
    const { error, run } = useAsynchronousTask(fn);

    expect(error.value).toBe(undefined);

    await run();

    expect(error.value?.message).toBe('error message');
  });

  it('throws an unhandled exception when execution error is unkown', async () => {
    const fn = () => {
      throw 'unknown exception';
    };
    const { error, run } = useAsynchronousTask(fn);

    await expect(run()).rejects.toThrow('unknown exception');

    expect(error.value?.message).toBe('Unknown Failure!');
  });

  it('provides status feedback when callback execution is running', async () => {
    const fn = async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    };
    const { active, run } = useAsynchronousTask(fn);

    expect(active.value).toBe(false);

    run();

    expect(active.value).toBe(true);

    vi.advanceTimersByTime(1000);
    await flushPromises();

    expect(active.value).toBe(false);
  });
});
