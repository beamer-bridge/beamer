/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ref } from 'vue';

import { useWallet } from '@/composables/useWallet';
import * as web3ProviderService from '@/services/web3-provider';
import { WalletType } from '@/types/settings';
import { MockedEthereumProvider } from '~/utils/mocks/ethereum-provider';

vi.mock('@/services/web3-provider');

describe('useWallets', () => {
  beforeEach(() => {
    web3ProviderService!.createMetaMaskProvider = vi.fn();
    web3ProviderService!.createWalletConnectProvider = vi.fn();
  });

  describe('getConnectedWalletProvider', () => {
    it('should return undefined if no providers are connected', async () => {
      const { getConnectedWalletProvider } = useWallet(ref(undefined), ref(undefined));

      const provider = await getConnectedWalletProvider();

      expect(provider).toBeUndefined();
    });

    it('should call createMetaMaskProvider and return a provider', async () => {
      const wallet = useWallet(ref(undefined), ref(WalletType.MetaMask));
      const metaMask = new MockedEthereumProvider();
      web3ProviderService!.createMetaMaskProvider = vi.fn().mockResolvedValue(metaMask);

      const provider = await wallet.getConnectedWalletProvider();

      expect(web3ProviderService.createMetaMaskProvider).toHaveBeenCalledOnce();
      expect(web3ProviderService.createMetaMaskProvider).toHaveBeenLastCalledWith();
      expect(provider).toEqual(metaMask);
    });

    it('should call createWalletConnectProvider and return a provider', async () => {
      const rpcUrls = { 5: 'fakeRpc.url' };
      const wallet = useWallet(ref(undefined), ref(WalletType.WalletConnect), rpcUrls);
      const walletConnect = new MockedEthereumProvider();
      web3ProviderService!.createWalletConnectProvider = vi.fn().mockResolvedValue(walletConnect);

      const provider = await wallet.getConnectedWalletProvider();

      expect(web3ProviderService.createWalletConnectProvider).toHaveBeenCalledOnce();
      expect(web3ProviderService.createWalletConnectProvider).toHaveBeenLastCalledWith(rpcUrls);
      expect(provider).toEqual(walletConnect);
    });

    it('should return undefined if no rpc urls are passed for WalletConnect type', async () => {
      const wallet = useWallet(ref(undefined), ref(undefined), undefined);

      const provider = await wallet.getConnectedWalletProvider();

      expect(provider).toBeUndefined();
    });
  });

  describe('connectMetaMask', () => {
    it('should not set provider in settings if no requestSigner has been passed', async () => {
      const connectedWallet = ref(undefined);
      const wallet = useWallet(ref(undefined), connectedWallet, undefined, undefined);

      await wallet.connectMetaMask();

      expect(connectedWallet.value).toBeUndefined();
    });

    it('should set connected wallet type in settings to MetaMask', async () => {
      const connectedWallet = ref(undefined);
      const wallet = useWallet(ref(undefined), connectedWallet, undefined, vi.fn());
      web3ProviderService!.createMetaMaskProvider = vi.fn().mockResolvedValue('fake-provider');

      await wallet.connectMetaMask();

      expect(connectedWallet).toBe(WalletType.MetaMask);
    });
  });

  describe('connectWalletConnect', () => {
    it('should not set provider in settings if no RPC URLs are passed', async () => {
      const connectedWallet = ref(undefined);
      const wallet = useWallet(ref(undefined), connectedWallet, undefined);

      await wallet.connectWalletConnect();

      expect(connectedWallet).toBeUndefined();
    });

    it('should set connected wallet type in settings to WalletConnect', async () => {
      const connectedWallet = ref(undefined);
      const rpcUrls = { 5: 'fakeRpc.url' };
      const wallet = useWallet(ref(undefined), connectedWallet, rpcUrls);
      web3ProviderService!.createWalletConnectProvider = vi
        .fn()
        .mockResolvedValue('fake-provider');

      await wallet.connectWalletConnect();

      expect(connectedWallet).toBe(WalletType.WalletConnect);
    });
  });
});
