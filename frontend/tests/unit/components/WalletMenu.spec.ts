import { JsonRpcProvider, JsonRpcSigner } from '@ethersproject/providers';
import { createTestingPinia } from '@pinia/testing';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';

import WalletMenu from '@/components/WalletMenu.vue';
import type { useWallet } from '@/composables/useWallet';
import * as useWalletComposable from '@/composables/useWallet';
import * as userAgent from '@/utils/userAgent';
import { MockedEthereumWallet } from '~/utils/mocks/ethereum-provider';

vi.mock('@ethersproject/providers');

function createWrapper(options?: { provider: MockedEthereumWallet }) {
  return mount(WalletMenu, {
    shallow: true,
    global: {
      plugins: [
        createTestingPinia({
          initialState: {
            ethereumWallet: {
              provider: options?.provider ?? new MockedEthereumWallet(),
            },
          },
        }),
      ],
    },
  });
}

function createUseWalletComposableReturnValue(
  partialReturnObject?: Partial<ReturnType<typeof useWallet>>,
) {
  return {
    connectMetaMask: vi.fn(),
    connectWalletConnect: vi.fn(),
    connectingMetaMask: ref(false),
    connectingWalletConnect: ref(false),
    connectCoinbase: vi.fn(),
    connectingCoinbase: ref(false),
    connectInjected: vi.fn(),
    connectingInjected: ref(false),
    ...partialReturnObject,
  };
}

describe('WalletMenu.vue', () => {
  beforeEach(() => {
    Object.defineProperty(useWalletComposable, 'useWallet', {
      value: vi.fn().mockReturnValue(createUseWalletComposableReturnValue()),
    });
  });

  it('connects MetaMask on click', () => {
    const connectMetaMask = vi.fn();
    Object.defineProperty(useWalletComposable, 'useWallet', {
      value: vi.fn().mockReturnValue(createUseWalletComposableReturnValue({ connectMetaMask })),
    });
    const wrapper = createWrapper();
    const button = wrapper.get('[data-test="connect-MetaMask"]');

    button.trigger('click');
    expect(connectMetaMask).toHaveBeenCalledOnce();
  });

  it('connects WalletConnect on click', () => {
    const connectWalletConnect = vi.fn();
    Object.defineProperty(useWalletComposable, 'useWallet', {
      value: vi
        .fn()
        .mockReturnValue(createUseWalletComposableReturnValue({ connectWalletConnect })),
    });
    const wrapper = createWrapper();
    const button = wrapper.get('[data-test="connect-WalletConnect"]');

    button.trigger('click');
    expect(connectWalletConnect).toHaveBeenCalledOnce();
  });

  it('connects Coinbase on click', () => {
    const connectCoinbase = vi.fn();
    Object.defineProperty(useWalletComposable, 'useWallet', {
      value: vi.fn().mockReturnValue(createUseWalletComposableReturnValue({ connectCoinbase })),
    });
    const wrapper = createWrapper();
    const button = wrapper.get('[data-test="connect-Coinbase"]');

    button.trigger('click');
    expect(connectCoinbase).toHaveBeenCalledOnce();
  });

  it('connects to a browser injected wallet on click', () => {
    const connectInjected = vi.fn();
    Object.defineProperty(useWalletComposable, 'useWallet', {
      value: vi.fn().mockReturnValue(createUseWalletComposableReturnValue({ connectInjected })),
    });
    const wrapper = createWrapper();
    const button = wrapper.get('[data-test="connect-Browser Wallet"]');

    button.trigger('click');
    expect(connectInjected).toHaveBeenCalledOnce();
  });

  it('closes on click on close button', () => {
    const wrapper = createWrapper();
    const closeButton = wrapper.get('[data-test="close-button"]');

    closeButton.trigger('click');
    expect(wrapper.emitted('close')).toBeTruthy();
  });

  it('closes when signer is available', async () => {
    const provider = new MockedEthereumWallet();
    const wrapper = createWrapper({ provider });

    provider.signer.value = new JsonRpcSigner(undefined, new JsonRpcProvider());
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('close')).toBeTruthy();
  });

  describe('on mobile', () => {
    beforeEach(() => {
      Object.defineProperty(userAgent, 'isMobile', {
        value: vi.fn().mockReturnValue(true),
      });
    });

    describe('if MetaMask is available', () => {
      it('filters options to only include MetaMask provider', async () => {
        vi.stubGlobal('ethereum', { isMetaMask: true });
        const wrapper = createWrapper();
        await wrapper.vm.$nextTick();

        const options = wrapper.findAll('[data-test|="connect"]');

        expect(wrapper.text()).toMatch('MetaMask');
        expect(options.length).toBe(1);
      });
    });

    describe('if Coinbase is available', () => {
      it('filters options to only include Coinbase provider', async () => {
        vi.stubGlobal('ethereum', { isCoinbaseWallet: true });
        const wrapper = createWrapper();
        await wrapper.vm.$nextTick();

        const options = wrapper.findAll('[data-test|="connect"]');

        expect(wrapper.text()).toMatch('Coinbase');
        expect(options.length).toBe(1);
      });
    });

    describe('if no injected provider is available', () => {
      it('filters options to only include providers that have mobile flow support', async () => {
        vi.stubGlobal('ethereum', undefined);
        const wrapper = createWrapper();
        await wrapper.vm.$nextTick();

        const text = wrapper.text();
        expect(text).toMatch('Coinbase');
        expect(text).toMatch('WalletConnect');
        expect(text).not.toMatch('MetaMask');
        expect(text).not.toMatch('Browser Wallet');
      });
    });
  });

  describe('on desktop', () => {
    beforeEach(() => {
      Object.defineProperty(userAgent, 'isMobile', {
        value: vi.fn().mockReturnValue(false),
      });
    });

    describe('if MetaMask is available', () => {
      it('hides the option to connect with other browser wallet extensions', async () => {
        vi.stubGlobal('ethereum', { isMetaMask: true });
        const wrapper = createWrapper();
        await wrapper.vm.$nextTick();

        const text = wrapper.text();
        expect(text).not.toMatch('Browser Wallet');
      });
    });
    describe('if MetaMask is not available', () => {
      describe('but another injected provider is available', () => {
        it('hides MetaMask option', async () => {
          vi.stubGlobal('ethereum', { isMetaMask: false });
          const wrapper = createWrapper();
          await wrapper.vm.$nextTick();

          const text = wrapper.text();
          expect(text).not.toMatch('MetaMask');
        });
        it('shows Browser Wallet option', async () => {
          vi.stubGlobal('ethereum', { isMetaMask: false });
          const wrapper = createWrapper();
          await wrapper.vm.$nextTick();

          const text = wrapper.text();
          expect(text).toMatch('Browser Wallet');
        });
      });

      describe('and no other injected provider is available', () => {
        it('shows MetaMask option in order to provide onboarding', async () => {
          vi.stubGlobal('ethereum', undefined);
          const wrapper = createWrapper();
          await wrapper.vm.$nextTick();

          const text = wrapper.text();
          expect(text).toMatch('MetaMask');
        });
      });
    });
  });
});
