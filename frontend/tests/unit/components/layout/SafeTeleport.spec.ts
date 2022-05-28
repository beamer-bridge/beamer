import { enableAutoUnmount, mount } from '@vue/test-utils';

import SafeTeleport from '@/components/layout/SafeTeleport.vue';

const TestComponentWithPortal = {
  template:
    '<div v-if="displayPortal" id="portal" />' +
    '<SafeTeleport to="#portal"><slot /></SafeTeleport>',
  props: ['displayPortal'],
  components: { SafeTeleport },
};

async function createWrapper(options?: { displayPortal?: boolean; slot?: string }) {
  const wrapper = mount(TestComponentWithPortal, {
    props: { displayPortal: options?.displayPortal ?? false },
    slots: { default: options?.slot ?? '' },
    attachTo: document.body,
  });

  // Wait for the next tick to see changes applied by `onMounted` hook.
  await wrapper.vm.$nextTick();
  return wrapper;
}

enableAutoUnmount(afterEach);

describe('SafeTeleport.vue', () => {
  it('activates teleport if portal is availale initially', async () => {
    const wrapper = await createWrapper({ displayPortal: true, slot: 'teleport content' });

    expect(wrapper.text()).toContain('teleport content');
  });

  it('hides teleport if portal is not availale', async () => {
    const wrapper = await createWrapper({ displayPortal: false, slot: 'teleport content' });

    expect(wrapper.text()).not.toContain('teleport content');
  });

  describe('with mutation observer support', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'MutationObserver', {
        value: vi.fn().mockImplementation(() => ({ observe: vi.fn(), disconnect: vi.fn() })),
      });
    });

    it('creates observer if portal is not available and browser supports it', async () => {
      const observerConstructor = vi
        .fn()
        .mockImplementation(() => ({ observe: vi.fn(), disconnect: vi.fn() }));
      Object.defineProperty(window, 'MutationObserver', { value: observerConstructor });

      await createWrapper({ displayPortal: false });

      expect(observerConstructor).toHaveBeenCalledOnce();
      expect(observerConstructor).toHaveBeenLastCalledWith(expect.any(Function));
    });

    it('starts to observe for mutations if portal is not available', async () => {
      const observe = vi.fn();
      Object.defineProperty(window, 'MutationObserver', {
        value: vi.fn().mockImplementation(() => ({ observe, disconnect: vi.fn() })),
      });

      await createWrapper({ displayPortal: false });

      expect(observe).toHaveBeenCalledOnce();
      expect(observe).toHaveBeenLastCalledWith(expect.any(HTMLElement), {
        childList: true,
        subtree: true,
      });
    });

    it('keeps hiding teleport if observer triggers, but portal still not available', async () => {
      let observerCallback = vi.fn();

      Object.defineProperty(global.window, 'MutationObserver', {
        value: vi.fn().mockImplementation((callback) => {
          observerCallback = callback;
          return { observe: vi.fn(), disconnect: vi.fn() };
        }),
      });

      const wrapper = await createWrapper({ displayPortal: false, slot: 'teleport content' });
      expect(wrapper.text()).not.toContain('teleport content');

      observerCallback();
      await wrapper.vm.$nextTick();

      expect(wrapper.text()).not.toContain('teleport content');
    });

    it('activates teleport if observer triggers and portal has become available', async () => {
      let observerCallback = vi.fn();

      Object.defineProperty(global.window, 'MutationObserver', {
        value: vi.fn().mockImplementation((callback) => {
          observerCallback = callback;
          return { observe: vi.fn(), disconnect: vi.fn() };
        }),
      });

      const wrapper = await createWrapper({ displayPortal: false, slot: 'teleport content' });
      expect(wrapper.text()).not.toContain('teleport content');

      await wrapper.setProps({ ...wrapper.props(), displayPortal: true });
      observerCallback();
      await wrapper.vm.$nextTick();

      expect(wrapper.text()).toContain('teleport content');
    });

    it('disconnects observer once teleport got activated', async () => {
      let observerCallback = vi.fn();
      const disconnect = vi.fn();

      Object.defineProperty(global.window, 'MutationObserver', {
        value: vi.fn().mockImplementation((callback) => {
          observerCallback = callback;
          return { observe: vi.fn(), disconnect };
        }),
      });

      const wrapper = await createWrapper({ displayPortal: false, slot: 'teleport content' });
      await wrapper.setProps({ ...wrapper.props(), displayPortal: true });
      observerCallback();
      await wrapper.vm.$nextTick();

      expect(disconnect).toHaveBeenCalledOnce();
    });
  });

  describe('without mutation observer support', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'MutationObserver', { value: undefined });
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('periodically checks portal availability', async () => {
      const wrapper = await createWrapper({ displayPortal: false, slot: 'teleport content' });
      expect(wrapper.text()).not.toContain('teleport content');

      vi.advanceTimersToNextTimer();
      await wrapper.vm.$nextTick();
      expect(wrapper.text()).not.toContain('teleport content');

      await wrapper.setProps({ ...wrapper.props(), displayPortal: true });
      vi.advanceTimersToNextTimer();
      await wrapper.vm.$nextTick();
      expect(wrapper.text()).toContain('teleport content');
    });
  });
});
