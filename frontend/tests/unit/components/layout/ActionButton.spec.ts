import { mount } from '@vue/test-utils';

import ActionButton from '@/components/layout/ActionButton.vue';

function createWrapper(options?: { slot?: string; disabled?: boolean }) {
  return mount(ActionButton, {
    shallow: true,
    slots: { default: options?.slot ?? '' },
    props: { disabled: options?.disabled },
  });
}

describe('ActionButton.vue', () => {
  it('shows the slot', () => {
    const wrapper = createWrapper({ slot: 'test content' });

    expect(wrapper.text()).toContain('test content');
  });

  it('can be disabled', () => {
    const wrapper = createWrapper({ disabled: true });

    expect(wrapper.attributes()).toContain({ disabled: '' });
  });
});
