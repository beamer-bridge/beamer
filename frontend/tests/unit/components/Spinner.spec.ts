import { mount } from '@vue/test-utils';

import Spinner from '@/components/Spinner.vue';

function createWrapper(options?: { sizeClasses?: string; border?: string }) {
  return mount(Spinner, {
    shallow: true,
    props: {
      sizeClasses: options?.sizeClasses ?? undefined,
      border: options?.border ?? undefined,
    },
  });
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

  it('properly defines spinner size based on passed props', () => {
    const wrapper = createWrapper({ sizeClasses: 'w-100 h-100' });

    expect(wrapper.classes()).toContain('w-100');
    expect(wrapper.classes()).toContain('h-100');
  });

  it('properly defines spinner border size based on passed props', () => {
    const wrapper = createWrapper({ border: '4' });

    expect(wrapper.classes()).toContain('border-4');
  });
});
