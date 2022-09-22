import { enableAutoUnmount, mount } from '@vue/test-utils';

import Tooltip from '@/components/layout/Tooltip.vue';

async function createWrapper(options?: {
  hint?: string;
  tooltipWidth?: string;
  gap?: string;
  arrowSize?: number;
  defaultSlot?: string;
  hintSlot?: string;
  showTooltip?: boolean;
}) {
  const wrapper = mount(Tooltip, {
    shallow: true,
    slots: {
      default: options?.defaultSlot ?? '',
      hint: options?.hintSlot ?? '',
    },
    props: {
      hint: options?.hint,
      tooltipWidth: options?.tooltipWidth,
      gap: options?.gap,
      arrowSize: options?.arrowSize,
    },
    attachTo: document.getElementById('container') ?? document.body,
  });

  if (options?.showTooltip) {
    await wrapper.trigger('mouseover');
  }

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

  it('always renders the default slot ', async () => {
    const wrapper = await createWrapper({ defaultSlot: '<div>some content</div>' });

    expect(wrapper.html()).toContain('<div>some content</div>');
  });

  it('hides tooltip per default', async () => {
    const wrapper = await createWrapper();
    const tooltip = wrapper.find('[data-test="tooltip"]');

    expect(tooltip.exists()).toBeFalsy();
  });

  it('allows controlling tooltip visibility based on mouse events', async () => {
    const wrapper = await createWrapper();

    expect(wrapper.find('[data-test="tooltip"]').exists()).toBeFalsy();
    await wrapper.trigger('mouseover');
    expect(wrapper.find('[data-test="tooltip"]').exists()).toBeTruthy();
    await wrapper.trigger('mouseout');
    expect(wrapper.find('[data-test="tooltip"]').exists()).toBeFalsy();
  });

  it('renders hint property into tooltip', async () => {
    const wrapper = await createWrapper({ hint: 'test hint', showTooltip: true });
    const tooltip = wrapper.find('[data-test="tooltip"]');

    expect(tooltip.text()).toContain('test hint');
  });

  it('renders hint slot into tooltip', async () => {
    const wrapper = await createWrapper({
      hintSlot: '<span>test hint</span>',
      showTooltip: true,
    });
    const tooltip = wrapper.get('[data-test="tooltip"]');

    expect(tooltip.html()).toContain('<span>test hint</span>');
  });

  it('sets width to tooltip', async () => {
    const wrapper = await createWrapper({ tooltipWidth: '200px', showTooltip: true });
    const tooltip = wrapper.get('[data-test="tooltip"]');

    expect((tooltip.element as HTMLElement).style).toContain({ width: '200px' });
  });

  it('adapts the arrow size', async () => {
    const wrapper = await createWrapper({ arrowSize: 20, showTooltip: true });
    const arrow = wrapper.get('[data-test="arrow"]');

    expect((arrow.element as HTMLElement).style).toContain({ width: '20px', height: '20px' });
  });

  describe('when not fitting in viewport', () => {
    /*
     * Note that it is currently not possible to test the actual positioning as
     * in the test environment, the `getBoundingClientRect()` of an HTML element
     * always returns zero for all properties.
     *
     * The position should be bottom of the content element in this case.
     */

    let windowWidth: number;
    beforeEach(() => {
      windowWidth = global.window.innerWidth;
      Object.defineProperty(global.window, 'innerWidth', { value: -1 });
    });
    afterEach(() => {
      Object.defineProperty(global.window, 'innerWidth', { value: windowWidth });
    });

    it('sets gap as vertical margin to tooltip', async () => {
      const wrapper = await createWrapper({ gap: '20px', showTooltip: true });
      const tooltip = wrapper.get('[data-test="tooltip"]');

      expect((tooltip.element as HTMLElement).style).toContain({ margin: '20px 0px' });
    });

    it('shows the arrow at the center of the top border', async () => {
      const wrapper = await createWrapper({
        arrowSize: 20,
        showTooltip: true,
      });
      const arrow = wrapper.get('[data-test="arrow"]');

      expect((arrow.element as HTMLElement).style).toContain({
        top: '-10px',
        right: 'calc(50% - 10px)',
      });
    });
  });

  describe('when fitting in viewport', () => {
    /*
     * Note that it is currently not possible to test the actual positioning as
     * in the test environment, the `getBoundingClientRect()` of an HTML element
     * always returns zero for all properties.
     *
     * The position should be right of the reference element in this case.
     */

    it('sets gap as horizontal margin to tooltip', async () => {
      const wrapper = await createWrapper({ gap: '20px', showTooltip: true });
      const tooltip = wrapper.get('[data-test="tooltip"]');

      expect((tooltip.element as HTMLElement).style).toContain({ margin: '0px 20px' });
    });

    it('shows the arrow at the center of the left border', async () => {
      const wrapper = await createWrapper({ arrowSize: 20, showTooltip: true });
      const arrow = wrapper.get('[data-test="arrow"]');

      expect((arrow.element as HTMLElement).style).toContain({
        top: 'calc(50% - 10px)',
        left: '0px',
      });
    });
  });
});
