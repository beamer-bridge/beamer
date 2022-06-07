import { mount } from '@vue/test-utils';

import Progress from '@/components/layout/Progress.vue';
import WaitingDots from '@/components/layout/WaitingDots.vue';

function createWrapper(options?: {
  steps?: Array<{
    label: string;
    active?: boolean;
    completed?: boolean;
    failed?: boolean;
    errorMessage?: string;
  }>;
}) {
  return mount(Progress, {
    shallow: true,
    props: {
      steps: options?.steps ?? [],
    },
  });
}
describe('Progress.vue', () => {
  it('renders all steps with each label', () => {
    const wrapper = createWrapper({ steps: [{ label: 'one' }, { label: 'two' }] });
    const listItems = wrapper.findAll('li');

    expect(listItems.length).toBe(2);
    expect(listItems[0].text()).toBe('one');
    expect(listItems[1].text()).toBe('two');
  });

  it('shows waiting dots to indicate active step', () => {
    const wrapper = createWrapper({
      steps: [
        { label: 'one', active: true },
        { label: 'two', active: false },
      ],
    });
    const listItems = wrapper.findAll('li');

    expect(listItems[0].findComponent(WaitingDots).exists()).toBeTruthy();
    expect(listItems[1].findComponent(WaitingDots).exists()).toBeFalsy();
  });

  it('indicates that a step got completed', () => {
    const wrapper = createWrapper({
      steps: [
        { label: 'one', completed: true },
        { label: 'two', completed: false },
      ],
    });
    const listItems = wrapper.findAll('li');

    expect(listItems[0].classes()).toContain('completed');
    expect(listItems[1].classes()).not.toContain('completed');
  });

  it('indicates that a step has failed', () => {
    const wrapper = createWrapper({
      steps: [
        { label: 'one', failed: true },
        { label: 'two', failed: false },
      ],
    });
    const listItems = wrapper.findAll('li');

    expect(listItems[0].classes()).toContain('failed');
    expect(listItems[1].classes()).not.toContain('failed');
  });

  it('shows error message of a step', () => {
    const wrapper = createWrapper({
      steps: [{ label: 'one', errorMessage: 'test error' }],
    });
    const listItems = wrapper.findAll('li');

    expect(listItems[0].text()).toContain('test error');
  });
});
