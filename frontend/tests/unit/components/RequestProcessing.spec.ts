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

    it('shows wait for confirmation as first step', () => {
      const requestMetadata = generateRequestMetadata({ state: ref(RequestState.Init) });
      const wrapper = createWrapper({ requestMetadata });
      const requestProgress = wrapper.get(requestProgressSelector);
      const waitConfirmStep = requestProgress.findAllComponents(ProgressStep)[0];

      expect(waitConfirmStep).toBeDefined();
      expect(waitConfirmStep.isVisible()).toBeTruthy();
      expect(waitConfirmStep.props()).toContain({ currentState: RequestState.Init });
      expect(waitConfirmStep.props()).toContain({ triggerState: RequestState.WaitConfirm });
    });

    it('shows wait for transaction as second step', () => {
      const requestMetadata = generateRequestMetadata({ state: ref(RequestState.Init) });
      const wrapper = createWrapper({ requestMetadata });
      const requestProgress = wrapper.get(requestProgressSelector);
      const waitTransactionStep = requestProgress.findAllComponents(ProgressStep)[1];

      expect(waitTransactionStep).toBeDefined();
      expect(waitTransactionStep.isVisible()).toBeTruthy();
      expect(waitTransactionStep.props()).toContain({ currentState: RequestState.Init });
      expect(waitTransactionStep.props()).toContain({
        triggerState: RequestState.WaitTransaction,
      });
    });

    it('shows wait for fulfilment as third step', () => {
      const requestMetadata = generateRequestMetadata({ state: ref(RequestState.Init) });
      const wrapper = createWrapper({ requestMetadata });
      const requestProgress = wrapper.get(requestProgressSelector);
      const waitFulfillStep = requestProgress.findAllComponents(ProgressStep)[2];

      expect(waitFulfillStep).toBeDefined();
      expect(waitFulfillStep.isVisible()).toBeTruthy();
      expect(waitFulfillStep.props()).toContain({ currentState: RequestState.Init });
      expect(waitFulfillStep.props()).toContain({ triggerState: RequestState.WaitFulfill });
    });

    it('shows request successful as last step', () => {
      const requestMetadata = generateRequestMetadata({ state: ref(RequestState.Init) });
      const wrapper = createWrapper({ requestMetadata });
      const requestProgress = wrapper.get(requestProgressSelector);
      const requestSuccessfulStep = requestProgress.findAllComponents(ProgressStep).slice(-1)[0];

      expect(requestSuccessfulStep).toBeDefined();
      expect(requestSuccessfulStep.isVisible()).toBeTruthy();
      expect(requestSuccessfulStep.props()).toContain({ currentState: RequestState.Init });
      expect(requestSuccessfulStep.props()).toContain({
        triggerState: RequestState.RequestSuccessful,
      });
      expect(requestSuccessfulStep.props()).toContain({ warnState: RequestState.RequestFailed });
    });
  });
});
