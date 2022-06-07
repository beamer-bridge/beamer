import { mount } from '@vue/test-utils';

import WaitingDots from '@/components/layout/WaitingDots.vue';

function createWrapper() {
  return mount(WaitingDots, { shallow: true });
}

describe('WaitingDots.vue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('updates the dots based on an interval in a cycle', async () => {
    const wrapper = createWrapper();

    const runNextInterval = async () => {
      vi.runOnlyPendingTimers();
      await wrapper.vm.$nextTick();
    };

    expect(wrapper.text()).toBe('');
    await runNextInterval();
    expect(wrapper.text()).toBe('.');
    await runNextInterval();
    expect(wrapper.text()).toBe('..');
    await runNextInterval();
    expect(wrapper.text()).toBe('...');
    await runNextInterval();
    expect(wrapper.text()).toBe('');
    await runNextInterval();
    expect(wrapper.text()).toBe('.');
    await runNextInterval();
    expect(wrapper.text()).toBe('..');
    await runNextInterval();
    expect(wrapper.text()).toBe('...');
  });
});
