import { createTestingPinia } from '@pinia/testing';
import { mount } from '@vue/test-utils';

import Disconnect from '@/components/wallet/Disconnect.vue';
import * as useWalletComposable from '@/composables/useWallet';
import { MockedEthereumWallet } from '~/utils/mocks/ethereum-provider';

vi.mock('@/composables/useWallet');

const createWrapper = () => {
  return mount(Disconnect, {
    shallow: true,
    global: {
      plugins: [
        createTestingPinia({
          initialState: {
            ethereumWallet: {
              provider: new MockedEthereumWallet(),
            },
          },
        }),
      ],
    },
  });
};

describe('Disconnect.vue', () => {
  beforeEach(() => {
    Object.defineProperty(useWalletComposable, 'useWallet', {
      value: vi.fn().mockReturnValue({
        disconnectWallet: vi.fn(),
      }),
    });
  });

  it('renders a trigger element', () => {
    const wrapper = createWrapper();
    const triggerElement = wrapper.find('[data-test="trigger"]');

    expect(triggerElement.exists()).toBe(true);
  });

  it('displays a text explaining the action', () => {
    const wrapper = createWrapper();

    expect(wrapper.text()).toEqual('Disconnect Wallet');
  });

  it('attempts to disconnect from connected wallet on click of the trigger', async () => {
    const disconnectWallet = vi.fn();
    Object.defineProperty(useWalletComposable, 'useWallet', {
      value: vi.fn().mockReturnValue({
        disconnectWallet,
      }),
    });

    const wrapper = createWrapper();

    const clickableElement = wrapper.find('[data-test="trigger"]');
    await clickableElement.trigger('click');

    expect(disconnectWallet).toHaveBeenCalled();
  });
});
