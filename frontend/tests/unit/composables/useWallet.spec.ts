/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ref } from 'vue';

import { useWallet } from '@/composables/useWallet';
import * as web3ProviderService from '@/services/web3-provider';
import { WalletType } from '@/types/settings';
import {
  MockedMetMaskProvider,
  MockedWalletConnectProvider,
} from '~/utils/mocks/ethereum-provider';

vi.mock('@/services/web3-provider');

describe('useWallets', () => {
  beforeEach(() => {
    web3ProviderService!.createMetaMaskProvider = vi.fn();
    web3ProviderService!.createWalletConnectProvider = vi.fn();
  });

  describe('getConnectedWalletProvider()', () => {
    it('should return undefined if no providers are connected', async () => {
      const { getConnectedWalletProvider } = useWallet(ref(undefined), ref(undefined), ref({}));

      const provider = await getConnectedWalletProvider();

      expect(provider).toBeUndefined();
    });

    it('should call createMetaMaskProvider and return a provider', async () => {
      const wallet = useWallet(ref(undefined), ref(WalletType.MetaMask), ref({}));
      const metaMask = new MockedMetMaskProvider();
      web3ProviderService!.createMetaMaskProvider = vi.fn().mockResolvedValue(metaMask);

      const provider = await wallet.getConnectedWalletProvider();

      expect(web3ProviderService.createMetaMaskProvider).toHaveBeenCalledOnce();
      expect(web3ProviderService.createMetaMaskProvider).toHaveBeenLastCalledWith();
      expect(provider).toEqual(metaMask);
    });

    it('should call createWalletConnectProvider and return a provider', async () => {
      const rpcUrls = ref({ 5: 'fakeRpc.url' });
      const wallet = useWallet(ref(undefined), ref(WalletType.WalletConnect), rpcUrls);
      const walletConnect = new MockedWalletConnectProvider();
      web3ProviderService!.createWalletConnectProvider = vi.fn().mockResolvedValue(walletConnect);

      const provider = await wallet.getConnectedWalletProvider();

      expect(web3ProviderService.createWalletConnectProvider).toHaveBeenCalledOnce();
      expect(web3ProviderService.createWalletConnectProvider).toHaveBeenLastCalledWith(
        rpcUrls.value,
      );
      expect(provider).toEqual(walletConnect);
    });
  });

  describe('connectMetaMask()', () => {
    it('should set connected wallet type in settings to MetaMask', async () => {
      const connectedWallet = ref(undefined);
      const wallet = useWallet(ref(undefined), connectedWallet, ref({}));
      web3ProviderService!.createMetaMaskProvider = vi
        .fn()
        .mockResolvedValue(new MockedMetMaskProvider());

      await wallet.connectMetaMask();

      expect(connectedWallet.value).toBe(WalletType.MetaMask);
    });
  });

  describe('connectWalletConnect', () => {
    it('should set connected wallet type in settings to WalletConnect', async () => {
      const connectedWallet = ref(undefined);
      const rpcUrls = ref({ 5: 'fakeRpc.url' });
      const wallet = useWallet(ref(undefined), connectedWallet, rpcUrls);
      web3ProviderService!.createWalletConnectProvider = vi
        .fn()
        .mockResolvedValue(new MockedWalletConnectProvider());

      await wallet.connectWalletConnect();

      expect(connectedWallet.value).toBe(WalletType.WalletConnect);
    });
  });
});
