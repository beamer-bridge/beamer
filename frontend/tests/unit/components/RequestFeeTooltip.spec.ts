import { mount } from '@vue/test-utils';

import RequestFeeTooltip from '@/components/RequestFeeTooltip.vue';

const createWrapper = (options?: { formattedMinFee?: string }) => {
  return mount(RequestFeeTooltip, {
    shallow: true,
    props: {
      formattedMinFee: options?.formattedMinFee,
    },
    global: {
      stubs: {
        Tooltip: {
          template: `<div><slot/><slot name="hint"/></div>`,
        },
      },
    },
  });
};
describe('RequestFeeTooltip', () => {
  it('renders a trigger for the tooltip', () => {
    const wrapper = createWrapper();
    const tooltipTrigger = wrapper.find('[data-test="tooltip-trigger"]');
    expect(tooltipTrigger.exists()).toBe(true);
  });
  it('renders some tooltip text', () => {
    const wrapper = createWrapper();
    const tooltipTextContainer = wrapper.find('[data-test="tooltip-text"]');
    expect(tooltipTextContainer.text()).not.toHaveLength(0);
  });
  it('shows minimum request fee text when provided as prop', () => {
    const wrapper = createWrapper({
      formattedMinFee: '0.1 TST',
    });

    const formattedMinFeeContainer = wrapper.find('[data-test="formatted-minimum-fee"]');
    expect(formattedMinFeeContainer.text()).toEqual('The minimum fee for a transfer is 0.1 TST');
  });
  it('does not show minimum request fee when prop is not provided', () => {
    const wrapper = createWrapper();

    const formattedMinFeeContainer = wrapper.find('[data-test="formatted-minimum-fee"]');
    expect(formattedMinFeeContainer.exists()).toBe(false);
  });
});
