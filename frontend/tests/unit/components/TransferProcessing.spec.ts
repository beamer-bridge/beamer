import { mount } from '@vue/test-utils';

import ProgressStep from '@/components/layout/ProgressStep.vue';
import TransferProgressing from '@/components/TransferProcessing.vue';
import { RequestState } from '@/types/data';

function createWrapper(options?: { state?: RequestState }) {
  return mount(TransferProgressing, {
    shallow: true,
    props: {
      state: options?.state ?? RequestState.Init,
    },
  });
}
describe('TransferProcessing.vue', () => {
  it('shows all four steps', () => {
    const wrapper = createWrapper();
    const progressSteps = wrapper.findAllComponents(ProgressStep);

    expect(progressSteps.length).toBe(4);
    expect(progressSteps[0].props()).toContain({
      label: 'Please confirm your request on Metamask',
    });
    expect(progressSteps[1].props()).toContain({ label: 'Waiting for transaction receipt' });
    expect(progressSteps[2].props()).toContain({ label: 'Request is being fulfilled' });
    expect(progressSteps[3].props()).toContain({ label: 'Transfer completed' });
  });

  it('sets correct completion state according to current request state', () => {
    const stepOrderToRequestState = [
      RequestState.WaitConfirm,
      RequestState.WaitTransaction,
      RequestState.WaitFulfill,
      RequestState.RequestSuccessful,
    ];

    for (const [stepIndex, stepState] of stepOrderToRequestState.entries()) {
      for (const state in RequestState) {
        const wrapper = createWrapper({ state: Number(state) });
        const progressStep = wrapper.findAllComponents(ProgressStep)[stepIndex];
        const completed = Number(state) >= stepState;

        expect(progressStep.props()).toContain({ completed: completed });
      }
    }
  });
});
