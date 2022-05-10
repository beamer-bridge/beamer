import { mount } from '@vue/test-utils';

import TransferProcessing from '@/components/TransferProcessing.vue';
import TransferStatus from '@/components/TransferStatus.vue';
import TransferSummary from '@/components/TransferSummary.vue';
import { RequestMetadata, RequestState } from '@/types/data';
import { generateRequestMetadata } from '~/utils/data_generators';

function createWrapper(options?: { metadata?: RequestMetadata; state?: RequestState }) {
  return mount(TransferStatus, {
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

describe('TransferStatus.vue', () => {
  it('shows transfer summary with correct metadata', () => {
    const metadata = generateRequestMetadata({
      amount: '0.1',
      tokenSymbol: 'TTT',
      sourceChainName: 'Foo',
      targetChainName: 'Bar',
      targetAddress: '0xAddress',
    });
    const wrapper = createWrapper({ metadata });
    const summary = wrapper.findComponent(TransferSummary);

    expect(summary.exists()).toBeTruthy();
    expect(summary.isVisible()).toBeTruthy();
    expect(summary.props()).toContain({ amount: '0.1' });
    expect(summary.props()).toContain({ tokenSymbol: 'TTT' });
    expect(summary.props()).toContain({ sourceChainName: 'Foo' });
    expect(summary.props()).toContain({ targetChainName: 'Bar' });
    expect(summary.props()).toContain({ targetAddress: '0xAddress' });
  });

  it('shows transfer processing with correct state', () => {
    const wrapper = createWrapper({ state: RequestState.WaitFulfill });
    const process = wrapper.findComponent(TransferProcessing);

    expect(process.exists()).toBeTruthy();
    expect(process.isVisible()).toBeTruthy();
    expect(process.props()).toContain({ state: RequestState.WaitFulfill });
  });
});
