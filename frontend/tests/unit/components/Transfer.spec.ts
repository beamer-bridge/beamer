import { mount } from '@vue/test-utils';
import { ref } from 'vue';

import { Transfer } from '@/actions/transfers';
import Expandable from '@/components/layout/Expandable.vue';
import Progress from '@/components/layout/Progress.vue';
import TransferComponent from '@/components/Transfer.vue';
import TransferStatus from '@/components/TransferStatus.vue';
import TransferSummary from '@/components/TransferSummary.vue';
import TransferWithdrawer from '@/components/TransferWithdrawer.vue';
import * as transferRequestComposable from '@/composables/useTransferRequest';
import * as ethereumWalletComposable from '@/stores/ethereum-wallet';
import {
  generateChain,
  generateRequestInformationData,
  generateToken,
  generateTokenAmountData,
  generateTransfer,
  generateTransferData,
  generateUInt256Data,
} from '~/utils/data_generators';

vi.mock('@/composables/useTransferRequest');
vi.mock('@/stores/ethereum-wallet');

function createWrapper(options?: { transfer?: Transfer }) {
  return mount(TransferComponent, {
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
      renderStubDefaultSlot: true,
    },
  });
}

describe('Transfer.vue', () => {
  beforeEach(() => {
    vi.useFakeTimers();

    Object.defineProperty(transferRequestComposable, 'useTransferRequest', {
      value: vi.fn().mockReturnValue({
        withdrawing: ref(false),
        withdrawError: ref(undefined),
        withdraw: vi.fn(),
      }),
    });

    Object.defineProperty(ethereumWalletComposable, 'useEthereumWallet', {
      value: vi.fn().mockReturnValue({ provider: ref(undefined) }),
    });
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

    it('shows the source amount with two decimal places', () => {
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
  });

  it('shows transfer summary with correct transfer metadata', () => {
    const data = generateTransferData({
      date: 1234,
      sourceAmount: generateTokenAmountData({
        amount: '1',
        token: generateToken({ symbol: 'TTT', decimals: 0 }),
      }),
      sourceChain: generateChain({
        name: 'Source Chain',
        explorerUrl: 'https://test.explorer',
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

  it('shows transfer status with correct data', () => {
    const transfer = generateTransfer({ completed: true });
    const wrapper = createWrapper({ transfer });
    const status = wrapper.findComponent(TransferStatus);

    expect(status.exists()).toBeTruthy();
    expect(status.isVisible()).toBeTruthy();
    expect(status.props()).toEqual({
      completed: true,
      failed: false,
      expired: false,
      active: false,
    });
  });

  describe('handles expired transfers correctly', () => {
    it('hides transfer withdrawer if transfer is not expired', async () => {
      const transfer = generateTransfer({ expired: false });
      const wrapper = createWrapper({ transfer });
      const withdrawer = wrapper.findComponent(TransferWithdrawer);

      expect(withdrawer.exists()).toBeFalsy();
    });

    it('shows transfers withdrawer if transfer has expired', () => {
      Object.defineProperty(transferRequestComposable, 'useTransferRequest', {
        value: vi.fn().mockReturnValue({
          withdrawing: ref(true),
          withdrawError: ref(new Error('test error')),
          withdraw: vi.fn(),
        }),
      });

      const transfer = generateTransfer({
        expired: true,
        transferData: generateTransferData({ withdrawn: false }),
      });
      const wrapper = createWrapper({ transfer });
      const withdrawer = wrapper.findComponent(TransferWithdrawer);

      expect(withdrawer.exists()).toBeTruthy();
      expect(withdrawer.isVisible()).toBeTruthy();
      expect(withdrawer.props()).toContain({ withdrawn: false });
      expect(withdrawer.props()).toContain({ withdrawInProgress: true });
      expect(withdrawer.props()).toContain({ errorMessage: 'test error' });
    });

    it('on event triggers withraw transaction with connected wallet', async () => {
      const runWithdrawTransfer = vi.fn();
      const provider = 'fake-provider';
      Object.defineProperty(transferRequestComposable, 'useTransferRequest', {
        value: vi.fn().mockReturnValue({
          withdrawing: ref(false),
          withdrawError: ref(undefined),
          withdraw: runWithdrawTransfer,
        }),
      });

      Object.defineProperty(ethereumWalletComposable, 'useEthereumWallet', {
        value: vi.fn().mockReturnValue({
          provider: ref(provider),
        }),
      });

      const transfer = generateTransfer({
        expired: true,
        transferData: generateTransferData({ withdrawn: false }),
      });
      const wrapper = createWrapper({ transfer });
      const withdrawer = wrapper.findComponent(TransferWithdrawer);

      await withdrawer.vm.$emit('withdraw');

      expect(runWithdrawTransfer).toHaveBeenCalledOnce();
      expect(runWithdrawTransfer).toHaveBeenLastCalledWith(transfer, provider);
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
