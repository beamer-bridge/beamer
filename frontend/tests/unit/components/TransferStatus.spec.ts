import { mount } from '@vue/test-utils';

import { Transfer } from '@/actions/transfers';
import Expandable from '@/components/layout/Expandable.vue';
import Progress from '@/components/layout/Progress.vue';
import TransferStatus from '@/components/TransferStatus.vue';
import TransferSummary from '@/components/TransferSummary.vue';
import {
  generateChain,
  generateRequestInformationData,
  generateToken,
  generateTokenAmountData,
  generateTransfer,
  generateTransferData,
  generateUInt256Data,
} from '~/utils/data_generators';

function createWrapper(options?: { transfer?: Transfer }) {
  return mount(TransferStatus, {
    shallow: true,
    props: {
      transfer: options?.transfer ?? new Transfer(generateTransferData()),
    },
    global: {
      stubs: {
        Expandable: {
          props: { isExpanded: Boolean },
          template: '<div><slot name="header" /><slot name="body" /></div>',
        },
      },
    },
  });
}

describe('TransferStatus.vue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  describe('header content', () => {
    it('shows the source token symbol', () => {
      const data = generateTransferData({
        sourceAmount: generateTokenAmountData({
          token: generateToken({ symbol: 'TTT' }),
        }),
      });
      const transfer = new Transfer(data);
      const wrapper = createWrapper({ transfer });
      const header = wrapper.find('[data-test="header"]');

      expect(header.text()).toContain('TTT');
    });

    it('shows the target chain name', () => {
      const data = generateTransferData({
        targetChain: generateChain({ name: 'Test Chain' }),
      });
      const transfer = new Transfer(data);
      const wrapper = createWrapper({ transfer });
      const header = wrapper.find('[data-test="header"]');

      expect(header.text()).toContain('Test Chain');
    });

    it('shows the source amount with digits after dot cut to two', () => {
      const data = generateTransferData({
        sourceAmount: generateTokenAmountData({
          amount: generateUInt256Data('12345'),
          token: generateToken({ decimals: 4 }),
        }),
      });
      const transfer = new Transfer(data);
      const wrapper = createWrapper({ transfer });
      const header = wrapper.find('[data-test="header"]');

      expect(header.text()).toContain('1.23');
    });

    it('shows the source token amount with final zeros if even value', () => {
      const data = generateTransferData({
        sourceAmount: generateTokenAmountData({
          amount: generateUInt256Data('1'),
          token: generateToken({ decimals: 0 }),
        }),
      });
      const transfer = new Transfer(data);
      const wrapper = createWrapper({ transfer });
      const header = wrapper.find('[data-test="header"]');

      expect(header.text()).toContain('1.00');
    });
  });

  it('shows transfer summary with correct data in the body', () => {
    const data = generateTransferData({
      date: 1234,
      sourceAmount: generateTokenAmountData({
        amount: '1',
        token: generateToken({ symbol: 'TTT', decimals: 0 }),
      }),
      sourceChain: generateChain({
        name: 'Source Chain',
        explorerTransactionUrl: 'https://test.explorer/tx/',
      }),
      targetChain: generateChain({ name: 'Target Chain' }),
      targetAccount: '0xTargetAccount',
      requestInformation: generateRequestInformationData({ transactionHash: '0xHash' }),
    });
    const transfer = new Transfer(data);
    const wrapper = createWrapper({ transfer });
    const summary = wrapper.findComponent(TransferSummary);

    expect(summary.exists()).toBeTruthy();
    expect(summary.isVisible()).toBeTruthy();
    expect(summary.props()).toEqual(expect.objectContaining({ date: new Date(1234) }));
    expect(summary.props()).toContain({ amount: '1' });
    expect(summary.props()).toContain({ tokenSymbol: 'TTT' });
    expect(summary.props()).toContain({ sourceChainName: 'Source Chain' });
    expect(summary.props()).toContain({ targetChainName: 'Target Chain' });
    expect(summary.props()).toContain({ targetAccount: '0xTargetAccount' });
    expect(summary.props()).toContain({ targetAccount: '0xTargetAccount' });
    expect(summary.props()).toContain({
      requestTransactionUrl: 'https://test.explorer/tx/0xHash',
    });
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

  describe('auto expansion', () => {
    it('sets itself to being expanded if becoming active', async () => {
      let transfer = generateTransfer({ active: false });
      const wrapper = createWrapper({ transfer });
      const expandable = wrapper.findComponent(Expandable);
      expect(expandable.props()).toContain({ isExpanded: false });

      transfer = generateTransfer({ active: true, transferData: transfer.encode() });
      await wrapper.setProps({ ...wrapper.props, transfer });
      vi.advanceTimersByTime(0);
      await wrapper.vm.$nextTick();

      expect(expandable.props()).toContain({ isExpanded: true });
    });

    it('sets itself to being collapsed after becoming inactive with a delay', async () => {
      let transfer = generateTransfer({ active: true });
      const wrapper = createWrapper({ transfer });
      const expandable = wrapper.findComponent(Expandable);
      expect(expandable.props()).toContain({ isExpanded: true });

      transfer = generateTransfer({ active: false, transferData: transfer.encode() });
      await wrapper.setProps({ ...wrapper.props, transfer });

      vi.advanceTimersByTime(2000);
      await wrapper.vm.$nextTick();
      expect(expandable.props()).toContain({ isExpanded: true });

      vi.advanceTimersByTime(10000);
      await wrapper.vm.$nextTick();
      expect(expandable.props()).toContain({ isExpanded: false });
    });
  });
});
