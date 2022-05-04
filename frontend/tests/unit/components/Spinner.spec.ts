import { mount } from '@vue/test-utils';

import Spinner from '@/components/Spinner.vue';

function createWrapper() {
  return mount(Spinner, { shallow: true });
}

describe('Spinner.vue', () => {
  it('has spinning animation', () => {
    const wrapper = createWrapper();

    expect(wrapper.classes()).toContain('animate-spin');
  });

  it('is rounded', () => {
    const wrapper = createWrapper();

    expect(wrapper.classes()).toContain('rounded-50');
    expect(wrapper.classes()).toContain('border-solid');
  });
});
