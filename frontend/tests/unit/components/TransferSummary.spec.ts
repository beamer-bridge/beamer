import { mount } from '@vue/test-utils';

import TransferSummary from '@/components/TransferSummary.vue';
import {
  getRandomChainName,
  getRandomDecimalPointNumber,
  getRandomEthereumAddress,
  getRandomTokenSymbol,
} from '~/utils/data_generators';

function createWrapper(options?: {
  amount?: string;
  tokenSymbol?: string;
  sourceChainName?: string;
  targetChainName?: string;
  targetAddress?: string;
}) {
  return mount(TransferSummary, {
    shallow: true,
    props: {
      amount: options?.amount ?? getRandomDecimalPointNumber(),
      tokenSymbol: options?.tokenSymbol ?? getRandomTokenSymbol(),
      sourceChainName: options?.sourceChainName ?? getRandomChainName(),
      targetChainName: options?.targetChainName ?? getRandomChainName(),
      targetAddress: options?.targetAddress ?? getRandomEthereumAddress(),
    },
  });
}

describe('TransferSummary.vue', () => {
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

  it('shows the target address', () => {
    const wrapper = createWrapper({ targetAddress: '0xTargetAddress' });

    expect(wrapper.text()).toContain('0xTargetAddress');
  });
});
