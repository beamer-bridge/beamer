import { flushPromises, mount } from '@vue/test-utils';

import LazyWrapper from '@/components/layout/LazyWrapper.vue';

async function resolveTimeouts() {
  vi.advanceTimersByTime(1);
  await flushPromises();
}

async function createWrapper(options?: {
  slot?: string;
  minimumHeight?: number;
  rootElement?: HTMLElement | null;
  rootMargin?: string;
  threshold?: number;
}) {
  const wrapper = mount(LazyWrapper, {
    shallow: true,
    slots: {
      default: options?.slot ?? '',
    },
    props: {
      minimumHeight: options?.minimumHeight,
      rootElement: options?.rootElement,
      rootMargin: options?.rootMargin,
      threshold: options?.threshold,
    },
  });

  await resolveTimeouts();

  return wrapper;
}

describe('LazyWrapper.vue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('always shows the slot if browser does not support intersection observers', async () => {
    Object.defineProperty(global, 'window', {
      writable: true,
      value: {},
    });
    expect(global.window).not.toHaveProperty('IntersectionObserver');

    const wrapper = await createWrapper({ slot: 'test content' });

    expect(wrapper.text()).toBe('test content');
  });

  it('creates observer with expected properties', async () => {
    const observerConstrutor = vi.fn().mockImplementation(() => ({ observe: vi.fn() }));

    Object.defineProperty(global.window, 'IntersectionObserver', {
      writable: true,
      value: observerConstrutor,
    });

    await createWrapper({
      rootElement: null,
      rootMargin: '2px',
      threshold: 1.0,
    });

    expect(observerConstrutor).toHaveBeenCalledOnce();
    expect(observerConstrutor).toHaveBeenLastCalledWith(expect.anything(), {
      root: null,
      rootMargin: '2px',
      threshold: 1.0,
    });
  });

  it('starts to observe top element', async () => {
    const observe = vi.fn();

    Object.defineProperty(global.window, 'IntersectionObserver', {
      writable: true,
      value: vi.fn().mockImplementation(() => ({ observe })),
    });

    await createWrapper();

    expect(observe).toHaveBeenCalledOnce();
    expect(observe).toHaveBeenLastCalledWith(expect.any(HTMLElement));
  });

  it('hides slot per default', async () => {
    Object.defineProperty(global.window, 'IntersectionObserver', {
      writable: true,
      value: vi.fn().mockImplementation(() => ({ observe: vi.fn() })),
    });

    const wrapper = await createWrapper({ slot: 'test content' });

    expect(wrapper.text()).toBe('');
  });

  it('shows and hides slot based on observer callback with visible state', async () => {
    let observerCallback = vi.fn();

    Object.defineProperty(global.window, 'IntersectionObserver', {
      writable: true,
      value: vi.fn().mockImplementation((callback) => {
        observerCallback = callback;
        return { observe: vi.fn() };
      }),
    });

    const wrapper = await createWrapper({ slot: 'test content' });

    expect(wrapper.text()).toBe('');

    observerCallback([{ isIntersecting: true }]);
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toBe('test content');

    observerCallback([{ isIntersecting: false }]);
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toBe('');
  });
});
