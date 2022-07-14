import { mount } from '@vue/test-utils';

import TextInput from '@/components/inputs/TextInput.vue';

function createWrapper(options?: { focusOnMount?: boolean; attachToBody?: boolean }) {
  return mount(TextInput, {
    shallow: true,
    props: {
      focusOnMount: options?.focusOnMount ?? false,
    },
    attachTo: options?.attachToBody ? document.body : undefined,
  });
}

describe('TextInput.vue', () => {
  it('shows an input field', () => {
    const wrapper = createWrapper();

    expect(wrapper.get('input[type="text"]'));
  });

  it('focuses on mount', () => {
    const wrapper = createWrapper({ focusOnMount: true, attachToBody: true });
    const inputElement = wrapper.get('input[type="text"]').element;

    expect(inputElement).toBe(document.activeElement);
  });
});
