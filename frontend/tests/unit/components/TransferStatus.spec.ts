import { mount } from '@vue/test-utils';

import { Transfer } from '@/actions/transfers';
import Progress from '@/components/layout/Progress.vue';
import TransferStatus from '@/components/TransferStatus.vue';
import TransferSummary from '@/components/TransferSummary.vue';
import {
  generateChain,
  generateToken,
  generateTokenAmountData,
  generateTransferData,
} from '~/utils/data_generators';

function createWrapper(options?: { transfer?: Transfer }) {
  return mount(TransferStatus, {
    shallow: true,
    props: {
      transfer: options?.transfer ?? new Transfer(generateTransferData()),
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
  it('shows transfer summary with correct data', () => {
    const data = generateTransferData({
      sourceAmount: generateTokenAmountData({
        amount: '1',
        token: generateToken({ symbol: 'TTT', decimals: 0 }),
      }),
      sourceChain: generateChain({ name: 'Source Chain' }),
      targetChain: generateChain({ name: 'Target Chain' }),
      targetAccount: '0xTargetAccount',
    });
    const transfer = new Transfer(data);
    const wrapper = createWrapper({ transfer });
    const summary = wrapper.findComponent(TransferSummary);

    expect(summary.exists()).toBeTruthy();
    expect(summary.isVisible()).toBeTruthy();
    expect(summary.props()).toContain({ amount: '1' });
    expect(summary.props()).toContain({ tokenSymbol: 'TTT' });
    expect(summary.props()).toContain({ sourceChainName: 'Source Chain' });
    expect(summary.props()).toContain({ targetChainName: 'Target Chain' });
    expect(summary.props()).toContain({ targetAccount: '0xTargetAccount' });
  });

  it('shows transfer progress with steps', () => {
    const data = generateTransferData();
    const transfer = new Transfer(data);
    const wrapper = createWrapper({ transfer });
    const process = wrapper.findComponent(Progress);

    expect(process.exists()).toBeTruthy();
    expect(process.isVisible()).toBeTruthy();
    expect(process.props('steps').length).toBeGreaterThanOrEqual(1);
  });
});
