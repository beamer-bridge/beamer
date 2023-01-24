import { enableAutoUnmount, mount } from '@vue/test-utils';

import EthereumAddress from '@/components/layout/EthereumAddress.vue';

function createWrapper(options?: { address?: string }) {
  return mount(EthereumAddress, {
    shallow: false,
    props: { address: options?.address ?? 'fake-address' },
    global: {
      stubs: {
        Tooltip: {
          template: '<div id="tooltip"><slot /><slot name="hint" /></div>',
          props: [],
        },
      },
    },
  });
}

enableAutoUnmount(afterEach);

describe('EthereumAddress.vue', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', { writable: true, value: undefined });
  });

  it('bar', async () => {
    const writeText = vi.fn();
    Object.defineProperty(navigator, 'clipboard', { writable: true, value: { writeText } });
    const wrapper = createWrapper({ address: '0x6626079BCF8c3241b082C73B74DFea46CeFA4f02' });
    await wrapper.get('[data-test="address"]').trigger('click');
    expect(writeText).toHaveBeenCalledOnce();
    expect(writeText).toHaveBeenLastCalledWith('0x6626079BCF8c3241b082C73B74DFea46CeFA4f02');
  });

  it('shows the first 6 and last 4 address characters with dots in-between', () => {
    const wrapper = createWrapper({ address: '0x6626079BCF8c3241b082C73B74DFea46CeFA4f02' });
    const address = wrapper.get('[data-test="address"]');

    expect(address.text()).toBe('0x6626...4f02');
  });

  describe('with clipboard support', () => {
    beforeEach(() => {
      Object.defineProperty(navigator, 'clipboard', {
        writable: true,
        value: { writeText: vi.fn() },
      });
    });

    it('write full address to clipboard on click', async () => {
      const writeText = vi.fn();
      Object.defineProperty(navigator, 'clipboard', { writable: true, value: { writeText } });
      const wrapper = createWrapper({ address: '0x6626079BCF8c3241b082C73B74DFea46CeFA4f02' });
      const address = wrapper.get('[data-test="address"]');

      await address.trigger('click');

      expect(writeText).toHaveBeenCalledOnce();
      expect(writeText).toHaveBeenLastCalledWith('0x6626079BCF8c3241b082C73B74DFea46CeFA4f02');
    });

    it('shortly changes tooltip to indicate copy was successful', async () => {
      const wrapper = createWrapper({ address: '0x6626079BCF8c3241b082C73B74DFea46CeFA4f02' });
      const address = wrapper.get('[data-test="address"]');

      await address.trigger('click');

      expect(wrapper.text()).toContain('Copied!');

      /*
       * I have absolutely no clue but for some reason it is not possible to use
       * fake timers here. Somehow this breaks a lot of things. Therefore an
       * actual "sleep" is necessary to still have a test for now.
       */
      await new Promise((resolve) => setTimeout(resolve, 1100));
      expect(wrapper.text()).not.toBe('Copied!');
    });
  });
});
