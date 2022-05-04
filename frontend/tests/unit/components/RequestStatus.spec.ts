import { mount } from '@vue/test-utils';

import RequestProcessing from '@/components/RequestProcessing.vue';
import RequestStatus from '@/components/RequestStatus.vue';
import RequestSummary from '@/components/RequestSummary.vue';
import { RequestMetadata, RequestState } from '@/types/data';
import { generateRequestMetadata } from '~/utils/data_generators';

function createWrapper(options?: { metadata?: RequestMetadata; state?: RequestState }) {
  return mount(RequestStatus, {
    shallow: true,
    props: {
      metadata: options?.metadata ?? generateRequestMetadata(),
      state: options?.state ?? RequestState.Init,
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

describe('RequestStatus.vue', () => {
  it('shows request summary with correct metadata', () => {
    const metadata = generateRequestMetadata({
      amount: '0.1',
      tokenSymbol: 'TTT',
      sourceChainName: 'Foo',
      targetChainName: 'Bar',
      targetAddress: '0xAddress',
    });
    const wrapper = createWrapper({ metadata });
    const summary = wrapper.findComponent(RequestSummary);

    expect(summary.exists()).toBeTruthy();
    expect(summary.isVisible()).toBeTruthy();
    expect(summary.props()).toContain({ amount: '0.1' });
    expect(summary.props()).toContain({ tokenSymbol: 'TTT' });
    expect(summary.props()).toContain({ sourceChainName: 'Foo' });
    expect(summary.props()).toContain({ targetChainName: 'Bar' });
    expect(summary.props()).toContain({ targetAddress: '0xAddress' });
  });

  it('shows request processing with correct state', () => {
    const wrapper = createWrapper({ state: RequestState.WaitFulfill });
    const process = wrapper.findComponent(RequestProcessing);

    expect(process.exists()).toBeTruthy();
    expect(process.isVisible()).toBeTruthy();
    expect(process.props()).toContain({ state: RequestState.WaitFulfill });
  });
});
