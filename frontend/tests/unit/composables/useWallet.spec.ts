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
      const connectedWallet = ref(undefined);
      const { getConnectedWalletProvider } = useWallet(ref(undefined), connectedWallet, vi.fn());

      const provider = await getConnectedWalletProvider();

      expect(provider).toBeUndefined();
    });

    it('should call createMetaMaskProvider and return a provider', async () => {
      const connectedWallet = ref(WalletType.MetaMask);
      const wallet = useWallet(ref(undefined), connectedWallet, vi.fn());
      const metaMask = new MockedEthereumProvider();
      web3ProviderService!.createMetaMaskProvider = vi.fn().mockResolvedValue(metaMask);

      const provider = await wallet.getConnectedWalletProvider();

      expect(web3ProviderService.createMetaMaskProvider).toHaveBeenCalledOnce();
      expect(web3ProviderService.createMetaMaskProvider).toHaveBeenLastCalledWith();
      expect(provider).toEqual(metaMask);
    });

    it('should call createWalletConnectProvider and return a provider', async () => {
      const connectedWallet = ref(WalletType.WalletConnect);
      const rpcUrls = { 5: 'fakeRpc.url' };
      const wallet = useWallet(ref(undefined), connectedWallet, vi.fn(), rpcUrls);
      const walletConnect = new MockedEthereumProvider();
      web3ProviderService!.createWalletConnectProvider = vi.fn().mockResolvedValue(walletConnect);

      const provider = await wallet.getConnectedWalletProvider();

      expect(web3ProviderService.createWalletConnectProvider).toHaveBeenCalledOnce();
      expect(web3ProviderService.createWalletConnectProvider).toHaveBeenLastCalledWith(rpcUrls);
      expect(provider).toEqual(walletConnect);
    });

    it('should return undefined if no rpc urls are passed for WalletConnect type', async () => {
      const connectedWallet = ref(WalletType.WalletConnect);
      const rpcUrls = undefined;
      const wallet = useWallet(ref(undefined), connectedWallet, vi.fn(), rpcUrls);

      const provider = await wallet.getConnectedWalletProvider();

      expect(provider).toBeUndefined();
    });
  });

  describe('connectMetaMask', () => {
    it('should not set provider in settings if no requestSigner has been passed', async () => {
      const setConnectedWallet = vi.fn();
      const requestSigner = undefined;
      const wallet = useWallet(
        ref(undefined),
        ref(undefined),
        setConnectedWallet,
        undefined,
        requestSigner,
      );

      await wallet.connectMetaMask();

      expect(setConnectedWallet).not.toHaveBeenCalled();
    });

    it('should set connected wallet type in settings to MetaMask', async () => {
      const setConnectedWallet = vi.fn();
      const requestSigner = vi.fn();
      const wallet = useWallet(
        ref(undefined),
        ref(undefined),
        setConnectedWallet,
        undefined,
        requestSigner,
      );
      web3ProviderService!.createMetaMaskProvider = vi.fn().mockResolvedValue('fake-provider');

      await wallet.connectMetaMask();

      expect(setConnectedWallet).toHaveBeenCalledOnce();
      expect(setConnectedWallet).toHaveBeenLastCalledWith(WalletType.MetaMask);
    });
  });

  describe('connectWalletConnect', () => {
    it('should not set provider in settings if no RPC URLs are passed', async () => {
      const setConnectedWallet = vi.fn();
      const rpcUrls = undefined;
      const wallet = useWallet(ref(undefined), ref(undefined), setConnectedWallet, rpcUrls);

      await wallet.connectWalletConnect();

      expect(web3ProviderService.createWalletConnectProvider).not.toHaveBeenCalled();
      expect(setConnectedWallet).not.toHaveBeenCalled();
    });

    it('should set connected wallet type in settings to WalletConnect', async () => {
      const setConnectedWallet = vi.fn();
      const rpcUrls = { 5: 'fakeRpc.url' };
      const wallet = useWallet(ref(undefined), ref(undefined), setConnectedWallet, rpcUrls);

      await wallet.connectWalletConnect();

      expect(web3ProviderService.createWalletConnectProvider).toHaveBeenCalledOnce();
      expect(web3ProviderService.createWalletConnectProvider).toHaveBeenLastCalledWith(rpcUrls);
      expect(setConnectedWallet).toHaveBeenCalledOnce();
      expect(setConnectedWallet).toHaveBeenLastCalledWith(WalletType.WalletConnect);
    });
  });
});
