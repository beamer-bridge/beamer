import { enableAutoUnmount, mount } from '@vue/test-utils';

import Tooltip from '@/components/layout/Tooltip.vue';

async function createWrapper(options?: { defaultSlot?: string; hintSlot?: string }) {
  const wrapper = mount(Tooltip, {
    shallow: false,
    slots: {
      default: options?.defaultSlot ?? '',
      hint: options?.hintSlot ?? '',
    },
    attachTo: document.getElementById('container') ?? document.body,
  });

  await wrapper.vm.$nextTick();
  return wrapper;
}

enableAutoUnmount(afterEach);

describe('Tooltip.vue', () => {
  beforeEach(() => {
    const container = document.createElement('div');
    container.setAttribute('id', 'container');
    container.setAttribute('style', 'margin: 500px; padding: 500px;');
    document.body.appendChild(container);
  });

  it('renders the default slot if provided', async () => {
    let wrapper = await createWrapper({ defaultSlot: 'default-slot' });
    expect(wrapper.get('[data-test="tooltip-trigger"]').text()).toContain('default-slot');

    wrapper = await createWrapper();
    expect(wrapper.get('[data-test="tooltip-trigger"]').text()).toContain('');
  });

  it('render a hint slot if provided', async () => {
    let wrapper = await createWrapper({
      defaultSlot: 'initPopper',
      hintSlot: 'hint-slot-content',
    });

    let tooltipContent = wrapper.find('[data-test="tooltip-content"]');
    expect(tooltipContent.text()).toContain('hint-slot-content');

    wrapper = await createWrapper({ defaultSlot: 'initPopper' });
    tooltipContent = wrapper.find('[data-test="tooltip-content"]');
    expect(tooltipContent.text()).toContain('');
  });
});
