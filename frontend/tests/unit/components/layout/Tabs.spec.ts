import { mount } from '@vue/test-utils';
import type { Component } from 'vue';
import { markRaw } from 'vue';

import Tabs from '@/components/layout/Tabs.vue';

async function createWrapper(options?: {
  leftLabel?: string;
  rightLabel?: string;
  leftContentComponent?: Component;
  rightContentComponent?: Component;
}) {
  const wrapper = mount(Tabs, {
    shallow: false,
    props: {
      leftLabel: options?.leftLabel ?? 'left',
      rightLabel: options?.rightLabel ?? 'right',
      leftContentComponent: options?.leftContentComponent ?? markRaw({ template: 'left' }),
      rightContentComponent: options?.rightContentComponent ?? markRaw({ template: 'right' }),
    },
  });

  // Because the tab content gets set in the `mount` hook, we need to await the
  // next tick first to see the effect.
  await wrapper.vm.$nextTick();

  return wrapper;
}

describe('Tabs.vue', () => {
  it('show left and right label', async () => {
    const wrapper = await createWrapper({ leftLabel: 'left label', rightLabel: 'right label' });

    expect(wrapper.text()).toContain('left label');
    expect(wrapper.text()).toContain('right label');
  });

  it('shows left tab content per default', async () => {
    const leftContentComponent = markRaw({ template: '<span>left content</span>' });
    const wrapper = await createWrapper({ leftContentComponent });
    const tabContent = wrapper.get('[data-test="tab-content"]');

    expect(tabContent.html()).toContain('<span>left content</span>');
  });

  it('can switch tab content via clicks on the headers', async () => {
    const leftContentComponent = markRaw({ template: '<span>left content</span>' });
    const rightContentComponent = markRaw({ template: '<span>right content</span>' });
    const wrapper = await createWrapper({ leftContentComponent, rightContentComponent });
    const leftTabHeader = wrapper.get('[data-test="left-tab-header"]');
    const rightTabHeader = wrapper.get('[data-test="right-tab-header"]');
    const tabContent = wrapper.get('[data-test="tab-content"]');

    expect(tabContent.html()).toContain('<span>left content</span>');

    await rightTabHeader.trigger('click');

    expect(tabContent.html()).toContain('<span>right content</span>');

    await leftTabHeader.trigger('click');

    expect(tabContent.html()).toContain('<span>left content</span>');
  });

  it('does not unload content component when tab changes', async () => {
    const leftContentComponent = markRaw({ template: '<input id="test-input" />' });
    const wrapper = await createWrapper({ leftContentComponent });
    const leftTabHeader = wrapper.get('[data-test="left-tab-header"]');
    const rightTabHeader = wrapper.get('[data-test="right-tab-header"]');

    // Just a stupid helper to get around typing issues.
    const getInputValue = () => (wrapper.find('#test-input').element as HTMLInputElement).value;

    await wrapper.get('#test-input').setValue('test value');

    expect(getInputValue()).toBe('test value');

    await rightTabHeader.trigger('click');

    expect(wrapper.find('#test-input').exists()).toBeFalsy();

    await leftTabHeader.trigger('click');

    expect(getInputValue()).toBe('test value');
  });
});
