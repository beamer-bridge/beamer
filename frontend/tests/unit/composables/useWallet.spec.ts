import { ref } from 'vue';

import { useWallet } from '@/composables/useWallet';
import * as web3ProviderService from '@/services/web3-provider';
import { WalletType } from '@/types/settings';
import {
  MockedMetaMaskProvider,
  MockedWalletConnectProvider,
} from '~/utils/mocks/ethereum-provider';

vi.mock('@/services/web3-provider');

describe('useWallets', () => {
  beforeEach(() => {
    Object.defineProperty(web3ProviderService, 'createMetaMaskProvider', {
      value: vi.fn().mockResolvedValue(new MockedMetaMaskProvider()),
    });
    Object.defineProperty(web3ProviderService, 'createWalletConnectProvider', {
      value: vi.fn().mockResolvedValue(new MockedWalletConnectProvider()),
    });
  });

  describe('connectMetaMask()', () => {
    it('creates a MetaMask provider instance', async () => {
      const { connectMetaMask } = useWallet(ref(undefined), ref(undefined), ref({}));

      await connectMetaMask();

      expect(web3ProviderService.createMetaMaskProvider).toHaveBeenCalledOnce();
    });

    it('requests the signer from the provider', async () => {
      const wallet = new MockedMetaMaskProvider();
      Object.defineProperty(web3ProviderService, 'createMetaMaskProvider', {
        value: vi.fn().mockResolvedValue(wallet),
      });
      const { connectMetaMask } = useWallet(ref(undefined), ref(undefined), ref({}));

      await connectMetaMask();

      expect(wallet.requestSigner).toHaveBeenCalledOnce();
    });

    it('sets the provider instance', async () => {
      const wallet = { requestSigner: vi.fn() }; // TODO: work-around for horrible mock typing issues.
      Object.defineProperty(web3ProviderService, 'createMetaMaskProvider', {
        value: vi.fn().mockResolvedValue(wallet),
      });
      const provider = ref(undefined);
      const { connectMetaMask } = useWallet(provider, ref(undefined), ref({}));

      await connectMetaMask();

      expect(provider.value).toEqual(wallet);
    });

    it('sets the connected wallet type', async () => {
      const connectedWallet = ref(undefined);
      const { connectMetaMask } = useWallet(ref(undefined), connectedWallet, ref({}));

      await connectMetaMask();

      expect(connectedWallet.value).toBe('metamask');
    });
    it('listens on wallet provider disconnect events', async () => {
      const wallet = new MockedMetaMaskProvider();
      Object.defineProperty(web3ProviderService, 'createMetaMaskProvider', {
        value: vi.fn().mockResolvedValue(wallet),
      });
      const { connectMetaMask, disconnectWallet } = useWallet(
        ref(undefined),
        ref(undefined),
        ref({}),
      );

      await connectMetaMask();

      expect(wallet.on).toHaveBeenCalledWith('disconnect', disconnectWallet);
    });

    describe('when onboarding is enabled', () => {
      it('starts onboarding process when metamask instance is not found', async () => {
        Object.defineProperty(web3ProviderService, 'createMetaMaskProvider', {
          value: vi.fn().mockResolvedValue(undefined),
        });

        const { connectMetaMask } = useWallet(ref(undefined), ref(undefined), ref({}));
        await connectMetaMask(true);
        expect(web3ProviderService.onboardMetaMask).toHaveBeenCalledOnce();
      });
    });
  });

  describe('connectWalletConnect()', () => {
    it('creates WalletConnect provider instance', async () => {
      const rpcUrls = ref({ 5: 'fakeRpc.url' });
      const { connectWalletConnect } = useWallet(ref(undefined), ref(undefined), rpcUrls);

      await connectWalletConnect();

      expect(web3ProviderService.createWalletConnectProvider).toHaveBeenCalledOnce();
      expect(web3ProviderService.createWalletConnectProvider).toHaveBeenLastCalledWith(
        rpcUrls.value,
      );
    });

    it('sets the provider instance', async () => {
      const wallet = 'fake-provider'; // TODO: work-around for horrible mock typing issues.
      Object.defineProperty(web3ProviderService, 'createWalletConnectProvider', {
        value: vi.fn().mockResolvedValue(wallet),
      });
      const provider = ref(undefined);
      const { connectWalletConnect } = useWallet(provider, ref(undefined), ref({}));

      await connectWalletConnect();

      expect(provider.value).toBe(wallet);
    });

    it('sets the connected wallet type', async () => {
      const connectedWallet = ref(undefined);
      const { connectWalletConnect } = useWallet(ref(undefined), connectedWallet, ref({}));

      await connectWalletConnect();

      expect(connectedWallet.value).toBe('wallet_connect');
    });
  });

  describe('reconnectToWallet()', () => {
    it('can reconnect to MetaMask', async () => {
      const provider = ref(undefined);
      const { reconnectToWallet } = useWallet(provider, ref(WalletType.MetaMask), ref({}));

      await reconnectToWallet();

      expect(provider.value).toBeInstanceOf(MockedMetaMaskProvider);
    });

    it('can reconnect to WalletConnect', async () => {
      const provider = ref(undefined);
      const { reconnectToWallet } = useWallet(provider, ref(WalletType.WalletConnect), ref({}));

      await reconnectToWallet();

      expect(provider.value).toBeInstanceOf(MockedWalletConnectProvider);
    });

    it('listens on wallet provider disconnect events', async () => {
      const wallet = new MockedMetaMaskProvider();
      Object.defineProperty(web3ProviderService, 'createWalletConnectProvider', {
        value: vi.fn().mockResolvedValue(wallet),
      });
      const { connectWalletConnect, disconnectWallet } = useWallet(
        ref(undefined),
        ref(undefined),
        ref({}),
      );

      await connectWalletConnect();

      expect(wallet.on).toHaveBeenCalledWith('disconnect', disconnectWallet);
    });
  });

  describe('disconnectWallet()', () => {
    it('disconnects from the currently connected wallet', async () => {
      const provider = ref(undefined);
      const connectedWallet = ref(undefined);
      const { connectMetaMask, disconnectWallet } = useWallet(provider, connectedWallet, ref({}));

      // Since we dont have a proper mocking strategy implemented for EthereumProvider we have to circumvent the issue like this
      await connectMetaMask();
      expect(provider.value).not.toBeUndefined();
      expect(connectedWallet.value).not.toBeUndefined();

      disconnectWallet();
      expect(provider.value).toBeUndefined();
      expect(connectedWallet.value).toBeUndefined();
    });
  });

  describe('disconnectWallet()', () => {
    it('disconnects from the currently connected wallet', async () => {
      const provider = ref(undefined);
      const connectedWallet = ref(undefined);
      const { connectMetaMask, disconnectWallet } = useWallet(provider, connectedWallet, ref({}));

      // Since we dont have a proper mocking strategy implemented for EthereumProvider we have to circumvent the issue like this
      await connectMetaMask();
      expect(provider.value).not.toBeUndefined();
      expect(connectedWallet.value).not.toBeUndefined();

      disconnectWallet();
      expect(provider.value).toBeUndefined();
      expect(connectedWallet.value).toBeUndefined();
    });
  });
});
