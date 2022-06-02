import { mount } from '@vue/test-utils';

import TransferStatus from '@/components/TransferStatus.vue';

function createWrapper(options?: { completed?: boolean; failed?: boolean; active?: boolean }) {
  return mount(TransferStatus, {
    shallow: true,
    props: {
      completed: options?.completed,
      failed: options?.failed,
      active: options?.active,
    },
  });
}

describe('TransferStatus.vue', () => {
  it('show correct completion label and color', () => {
    const wrapper = createWrapper({ completed: true });
    const label = wrapper.get('[data-test="label"]');

    expect(label.text()).toBe('Completed');
    expect(label.classes()).toContain('text-green');
  });

  it('show correct failure label and color', () => {
    const wrapper = createWrapper({ failed: true });
    const label = wrapper.get('[data-test="label"]');

    expect(label.text()).toBe('Failed');
    expect(label.classes()).toContain('text-red');
  });

  it('show correct in progress label and color', () => {
    const wrapper = createWrapper({ active: true });
    const label = wrapper.get('[data-test="label"]');

    expect(label.text()).toBe('In Progress');
    expect(label.classes()).toContain('text-green-lime');
  });
});
