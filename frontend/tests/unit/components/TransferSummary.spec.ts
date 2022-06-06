import { mount } from '@vue/test-utils';

import TransferSummary from '@/components/TransferSummary.vue';
import {
  getRandomChainName,
  getRandomDecimalPointNumber,
  getRandomEthereumAddress,
  getRandomTokenSymbol,
} from '~/utils/data_generators';

function createWrapper(options?: {
  date?: Date;
  amount?: string;
  tokenSymbol?: string;
  sourceChainName?: string;
  targetChainName?: string;
  targetAccount?: string;
  requestTransactionUrl?: string;
}) {
  return mount(TransferSummary, {
    shallow: true,
    props: {
      date: options?.date ?? new Date(Date.now()),
      amount: options?.amount ?? getRandomDecimalPointNumber(),
      tokenSymbol: options?.tokenSymbol ?? getRandomTokenSymbol(),
      sourceChainName: options?.sourceChainName ?? getRandomChainName(),
      targetChainName: options?.targetChainName ?? getRandomChainName(),
      targetAccount: options?.targetAccount ?? getRandomEthereumAddress(),
      requestTransactionUrl: options?.requestTransactionUrl,
    },
    global: {
      stubs: {
        EthereumAddress: {
          template: '<span>{{ address }}</span>',
          props: { address: String },
        },
      },
    },
  });
}

describe('TransferSummary.vue', () => {
  it('shows the date as locale string', () => {
    const date = new Date(10000);
    const wrapper = createWrapper({ date });

    expect(wrapper.text()).toContain(date.toLocaleString());
  });

  it('shows the amount', () => {
    const wrapper = createWrapper({ amount: '1.0' });

    expect(wrapper.text()).toContain('1.0');
  });

  it('shows the token symbol', () => {
    const wrapper = createWrapper({ tokenSymbol: 'TST' });

    expect(wrapper.text()).toContain('TST');
  });

  it('shows the source chain name', () => {
    const wrapper = createWrapper({ sourceChainName: 'Source Chain' });

    expect(wrapper.text()).toContain('Source Chain');
  });

  it('shows the target chain name', () => {
    const wrapper = createWrapper({ targetChainName: 'Target Chain' });

    expect(wrapper.text()).toContain('Target Chain');
  });

  it('shows the target account', () => {
    const wrapper = createWrapper({ targetAccount: '0xTargetAccount' });

    expect(wrapper.text()).toContain('0xTargetAccount');
  });

  it('shows no explorer URL when given', () => {
    const wrapper = createWrapper({ requestTransactionUrl: 'https://test.explorer/tx/0xabc' });
    const explorerLink = wrapper.find('[data-test="explorer-link"]');

    expect(explorerLink.isVisible()).toBeTruthy();
    expect(explorerLink.attributes()).toContain({ href: 'https://test.explorer/tx/0xabc' });
  });
});
