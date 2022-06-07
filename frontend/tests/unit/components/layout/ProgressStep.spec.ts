import { mount } from '@vue/test-utils';

import ProgressStep from '@/components/layout/ProgressStep.vue';
import WaitingDots from '@/components/layout/WaitingDots.vue';

function createWrapper(options?: {
  active?: boolean;
  completed?: boolean;
  failed?: boolean;
  label?: string;
}) {
  return mount(ProgressStep, {
    shallow: true,
    props: {
      label: options?.label ?? 'label',
      active: options?.active,
      completed: options?.completed,
      failed: options?.failed,
    },
  });
}

describe('ProgressStep.vue', () => {
  it('renders the given label', () => {
    const wrapper = createWrapper({ label: 'test label' });

    expect(wrapper.text()).toContain('test label');
  });

  it('shows waiting dots to indicate active step', async () => {
    const wrapper = createWrapper({ active: true });
    const dots = wrapper.findComponent(WaitingDots);

    expect(dots.exists()).toBeTruthy();
    expect(dots.isVisible()).toBeTruthy();
  });

  it('indicates that a step got completed', () => {
    const wrapper = createWrapper({ completed: true });

    expect(wrapper.classes()).toContain('step--completed');
  });

  it('indicates that a step failed', () => {
    const wrapper = createWrapper({ failed: true });

    expect(wrapper.classes()).toContain('step--failed');
  });

  it('never indictates completion if a step failed', () => {
    const wrapper = createWrapper({ completed: true, failed: true });

    expect(wrapper.classes()).not.toContain('step--completed');
  });
});
