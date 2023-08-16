import { mount } from '@vue/test-utils';
import { ref } from 'vue';

import ConnectionError from '@/components/wallet/ConnectionError.vue';
import Disconnect from '@/components/wallet/Disconnect.vue';
import WalletConnectionDetails from '@/components/WalletConnectionDetails.vue';
import * as useEthereumWalletComposable from '@/stores/ethereum-wallet';

vi.mock('@/stores/ethereum-wallet');

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
    const connectionError = wrapper.findComponent(ConnectionError);
    expect(connectionError.exists()).toBe(true);
  });

  describe('when wallet provider is connected', () => {
    beforeEach(() => {
      Object.defineProperty(useEthereumWalletComposable, 'useEthereumWallet', {
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
