import { mount } from '@vue/test-utils';

import SimpleTextButton from '@/components/layout/SimpleTextButton.vue';

function createWrapper(options?: { slot?: string }) {
  return mount(SimpleTextButton, {
    shallow: true,
    slots: { default: options?.slot ?? '' },
  });
}

describe('SimpleTextButton.vue', () => {
  it('shows the slot', () => {
    const wrapper = createWrapper({ slot: 'test content' });

    expect(wrapper.text()).toContain('test content');
  });
});
