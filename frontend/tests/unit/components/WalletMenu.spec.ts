import { JsonRpcProvider, JsonRpcSigner } from '@ethersproject/providers';
import { createTestingPinia } from '@pinia/testing';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';

import WalletMenu from '@/components/WalletMenu.vue';
import type { useWallet } from '@/composables/useWallet';
import * as useWalletComposable from '@/composables/useWallet';
import * as userAgent from '@/utils/userAgent';
import { MockedEthereumProvider } from '~/utils/mocks/ethereum-provider';

vi.mock('@ethersproject/providers');

function createWrapper(options?: { provider: MockedEthereumProvider }) {
  return mount(WalletMenu, {
    shallow: true,
    global: {
      plugins: [
        createTestingPinia({
          initialState: {
            ethereumProvider: {
              provider: options?.provider ?? new MockedEthereumProvider(),
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
    ...partialReturnObject,
  };
}

describe('WalletMenu.vue', () => {
  beforeEach(() => {
    Object.defineProperty(useWalletComposable, 'useWallet', {
      value: vi.fn().mockReturnValue(createUseWalletComposableReturnValue()),
    });
  });

  it('renders all available options', () => {
    const wrapper = createWrapper();
    const text = wrapper.text();
    expect(text).toMatch('MetaMask');
    expect(text).toMatch('WalletConnect');
    expect(text).toMatch('Coinbase');
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

  it('closes on click on close button', () => {
    const wrapper = createWrapper();
    const closeButton = wrapper.get('[data-test="close-button"]');

    closeButton.trigger('click');
    expect(wrapper.emitted('close')).toBeTruthy();
  });

  it('closes when signer is available', async () => {
    const provider = new MockedEthereumProvider();
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

        const text = wrapper.text();
        expect(text).toMatch('MetaMask');
        expect(text).not.toMatch('WalletConnect');
      });
    });

    describe('if Coinbase is available', () => {
      it('filters options to only include Coinbase provider', async () => {
        vi.stubGlobal('ethereum', { isCoinbaseWallet: true });
        const wrapper = createWrapper();
        await wrapper.vm.$nextTick();

        const text = wrapper.text();
        expect(text).toMatch('Coinbase');
        expect(text).not.toMatch('WalletConnect');
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
      });
    });
  });
});
