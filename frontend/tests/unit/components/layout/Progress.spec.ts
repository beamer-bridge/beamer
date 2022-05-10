import { mount } from '@vue/test-utils';

import Progress from '@/components/layout/Progress.vue';
import ProgressStep from '@/components/layout/ProgressStep.vue';

function createWrapper(options?: {
  steps?: Array<{
    label: string;
    completed?: boolean;
    failed?: boolean;
  }>;
}) {
  return mount(Progress, {
    shallow: true,
    props: {
      steps: options?.steps ?? [],
    },
  });
}
describe('RequestProcessing.vue', () => {
  it('sets correctly the label for each step', () => {
    const wrapper = createWrapper({ steps: [{ label: 'one' }, { label: 'two' }] });
    const progressSteps = wrapper.findAllComponents(ProgressStep);

    expect(progressSteps.length).toBe(2);
    expect(progressSteps[0].props()).toContain({ label: 'one' });
    expect(progressSteps[1].props()).toContain({ label: 'two' });
  });

  it('sets correct the completion state for each state', () => {
    const wrapper = createWrapper({
      steps: [
        { label: 'one', completed: true },
        { label: 'two', completed: false },
      ],
    });
    const progressSteps = wrapper.findAllComponents(ProgressStep);

    expect(progressSteps.length).toBe(2);
    expect(progressSteps[0].props()).toContain({ completed: true });
    expect(progressSteps[1].props()).toContain({ completed: false });
  });

  it('sets correct the failed state for each state', () => {
    const wrapper = createWrapper({
      steps: [
        { label: 'one', failed: true },
        { label: 'two', failed: false },
      ],
    });
    const progressSteps = wrapper.findAllComponents(ProgressStep);

    expect(progressSteps.length).toBe(2);
    expect(progressSteps[0].props()).toContain({ failed: true });
    expect(progressSteps[1].props()).toContain({ failed: false });
  });
});
