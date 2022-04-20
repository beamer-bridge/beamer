import { mount } from '@vue/test-utils';

import ProgressStep from '@/components/layout/ProgressStep.vue';
import { RequestState } from '@/types/data';

function createWrapper(options?: {
  currentState?: RequestState;
  triggerState?: RequestState;
  warnState?: RequestState;
  slot?: string;
}) {
  return mount(ProgressStep, {
    shallow: true,
    props: {
      currentState: options?.currentState ?? RequestState.Init,
      triggerState: options?.triggerState ?? RequestState.WaitConfirm,
      warnState: options?.warnState,
    },
    slots: {
      default: options?.slot ?? '',
    },
  });
}

describe('ProgressStep.vue', () => {
  it('shows success if current state equals trigger state', () => {
    const wrapper = createWrapper({
      currentState: RequestState.WaitConfirm,
      triggerState: RequestState.WaitConfirm,
    });

    expect(wrapper.classes()).toContain('step-success');
  });

  it('shows success if current state is greater than trigger state', () => {
    const wrapper = createWrapper({
      currentState: RequestState.WaitFulfill,
      triggerState: RequestState.WaitConfirm,
    });

    expect(wrapper.classes()).toContain('step-success');
  });

  it('shows warning if current state equals warn state', () => {
    const wrapper = createWrapper({
      currentState: RequestState.RequestFailed,
      warnState: RequestState.RequestFailed,
    });

    expect(wrapper.classes()).toContain('step-warning');
  });

  it('does not show success if current state is warn state and greater equal trigger state', () => {
    const wrapper = createWrapper({
      currentState: RequestState.WaitConfirm,
      triggerState: RequestState.WaitConfirm,
      warnState: RequestState.WaitConfirm,
    });

    expect(wrapper.classes()).not.toContain('step-success');
  });

  it('renders given default slot content', () => {
    const wrapper = createWrapper({ slot: 'test content' });

    expect(wrapper.text()).toContain('test content');
  });
});
