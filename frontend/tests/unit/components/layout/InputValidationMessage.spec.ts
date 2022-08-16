import { mount } from '@vue/test-utils';

import InputValidationMessage from '@/components/layout/InputValidationMessage.vue';

function createWrapper(options?: { defaultSlot?: string }) {
  return mount(InputValidationMessage, {
    shallow: true,
    slots: {
      default: options?.defaultSlot ?? '',
    },
  });
}
describe('InputValidationMessage.vue', () => {
  it('renders empty when no data was provided', () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toBe('');
  });

  it('shows message when provided as slot', () => {
    const slotData = 'slot test';
    const wrapper = createWrapper({ defaultSlot: slotData });
    expect(wrapper.text()).toBe(slotData);
  });
});
