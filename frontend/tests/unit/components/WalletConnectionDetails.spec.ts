import { mount } from '@vue/test-utils';
import { ref } from 'vue';

import Disconnect from '@/components/wallet/Disconnect.vue';
import WalletConnectionDetails from '@/components/WalletConnectionDetails.vue';
import * as useEthereumProviderComposable from '@/stores/ethereum-provider';

vi.mock('@/stores/ethereum-provider');

function createWrapper() {
  return mount(WalletConnectionDetails, {
    shallow: true,
    global: {
      stubs: {
        ConnectionError: {
          template: `<div><slot/></div>`,
        },
      },
    },
  });
}

describe('WalletConnectionDetails.vue', () => {
  it('renders connection error component', () => {
    const wrapper = createWrapper();
    const connectionError = wrapper.find('[data-test="error-component"]');
    expect(connectionError.exists()).toBe(true);
  });

  describe('when wallet provider is connected', () => {
    beforeEach(() => {
      Object.defineProperty(useEthereumProviderComposable, 'useEthereumProvider', {
        value: vi.fn().mockReturnValue({
          signer: ref('fake-signer'),
        }),
      });
    });

    it('renders wallet disconnect component', () => {
      const wrapper = createWrapper();
      const disconnectTrigger = wrapper.findComponent(Disconnect);
      expect(disconnectTrigger.exists()).toBe(true);
    });

    it('shows successful connection status message', () => {
      const wrapper = createWrapper();
      const details = wrapper.find('[data-test="details"]');
      expect(details.text()).toContain('You are currently connected');
    });
  });

  describe('when wallet provider is not connected', () => {
    it('hides connection details', () => {
      const wrapper = createWrapper();
      const details = wrapper.find('[data-test="details"]');
      expect(details.exists()).toBe(false);
    });
  });
});
