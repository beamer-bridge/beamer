import { mount } from '@vue/test-utils';
import { ref } from 'vue';

import ProgressStep from '@/components/layout/ProgressStep.vue';
import RequestProcessing from '@/components/RequestProcessing.vue';
import { RequestMetadata, RequestState } from '@/types/data';
import { generateRequestMetadata } from '~/utils/data_generators';

function createWrapper(options?: { requestMetadata?: RequestMetadata }) {
  return mount(RequestProcessing, {
    shallow: true,
    props: {
      requestMetadata: options?.requestMetadata ?? generateRequestMetadata(),
    },
    global: {
      stubs: {
        Card: {
          template: '<div><slot></slot></div>',
        },
      },
    },
  });
}
describe('RequestProcessing.vue', () => {
  describe('request summary section', () => {
    const requestSummarySelector = '[data-test="request-summary"]';

    it('displays a request summary section', () => {
      const wrapper = createWrapper();

      const requestSummary = wrapper.find(requestSummarySelector);

      expect(requestSummary.exists()).toBeTruthy();
      expect(requestSummary.isVisible()).toBeTruthy();
    });

    it('shows the amount', () => {
      const requestMetadata = generateRequestMetadata({ amount: '1.0' });
      const wrapper = createWrapper({ requestMetadata });
      const requestSummary = wrapper.get(requestSummarySelector);

      expect(requestSummary.text()).toContain('1.0');
    });

    it('shows the token symbol', () => {
      const requestMetadata = generateRequestMetadata({ tokenSymbol: 'TST' });
      const wrapper = createWrapper({ requestMetadata });
      const requestSummary = wrapper.get(requestSummarySelector);

      expect(requestSummary.text()).toContain('TST');
    });

    it('shows the source chain name', () => {
      const requestMetadata = generateRequestMetadata({ sourceChainName: 'Source Chain' });
      const wrapper = createWrapper({ requestMetadata });
      const requestSummary = wrapper.get(requestSummarySelector);

      expect(requestSummary.text()).toContain('Source Chain');
    });

    it('shows the target chain name', () => {
      const requestMetadata = generateRequestMetadata({ targetChainName: 'Target Chain' });
      const wrapper = createWrapper({ requestMetadata });
      const requestSummary = wrapper.get(requestSummarySelector);

      expect(requestSummary.text()).toContain('Target Chain');
    });

    it('shows the target address', () => {
      const requestMetadata = generateRequestMetadata({ targetAddress: '0xTargetAddress' });
      const wrapper = createWrapper({ requestMetadata });
      const requestSummary = wrapper.get(requestSummarySelector);

      expect(requestSummary.text()).toContain('0xTargetAddress');
    });
  });

  describe('request progress section', () => {
    const requestProgressSelector = '[data-test="request-progress"]';

    it('displays a request summary section', () => {
      const wrapper = createWrapper();

      const requestProgress = wrapper.find(requestProgressSelector);

      expect(requestProgress.exists()).toBeTruthy();
      expect(requestProgress.isVisible()).toBeTruthy();
    });

    it('shows all four steps', () => {
      const wrapper = createWrapper();
      const requestProgress = wrapper.get(requestProgressSelector);
      const progressSteps = requestProgress.findAllComponents(ProgressStep);

      expect(progressSteps.length).toBe(4);
      expect(progressSteps[0].props()).toContain({
        label: 'Please confirm your request on Metamask',
      });
      expect(progressSteps[1].props()).toContain({ label: 'Waiting for transaction receipt' });
      expect(progressSteps[2].props()).toContain({ label: 'Request is being fulfilled' });
      expect(progressSteps[3].props()).toContain({ label: 'Transfer completed' });
    });

    it('sets correct completion state according to current request state', () => {
      const requestMetadata = generateRequestMetadata();
      const stepOrderToRequestState = [
        RequestState.WaitConfirm,
        RequestState.WaitTransaction,
        RequestState.WaitFulfill,
        RequestState.RequestSuccessful,
      ];

      for (const [stepIndex, stepState] of stepOrderToRequestState.entries()) {
        for (const state in RequestState) {
          const wrapper = createWrapper({
            requestMetadata: { ...requestMetadata, state: ref(Number(state)) },
          });
          const progressStep = wrapper.findAllComponents(ProgressStep)[stepIndex];
          const completed = Number(state) >= stepState;

          expect(progressStep.props()).toContain({ completed: completed });
        }
      }
    });
  });
});
