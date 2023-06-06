import { mount } from '@vue/test-utils';

import RequestFeeTooltip from '@/components/RequestFeeTooltip.vue';

const createWrapper = () => {
  return mount(RequestFeeTooltip, {
    shallow: true,
    global: {
      stubs: {
        Tooltip: {
          template: `<div><slot/><slot name="hint"/></div>`,
        },
      },
    },
  });
};
describe('OptionDisabledTooltip', () => {
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
});
