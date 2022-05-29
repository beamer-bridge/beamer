import type { Ref } from 'vue';

import type { EthereumProvider } from '@/services/web3-provider';
import { createMetaMaskProvider, createWalletConnectProvider } from '@/services/web3-provider';
import { WalletType } from '@/types/settings';

export function useWallet(
  provider: Ref<EthereumProvider | undefined>,
  connectedWallet: Ref<WalletType | undefined>,
  rpcUrls: Ref<{ [chainId: number]: string }>,
) {
  async function connectMetaMask() {
    const metaMaskProvider = await createMetaMaskProvider();

    if (metaMaskProvider) {
      metaMaskProvider.requestSigner();
      provider.value = metaMaskProvider;
      connectedWallet.value = WalletType.MetaMask;
    }
  }

  async function connectWalletConnect() {
    const walletConnectProvider = await createWalletConnectProvider(rpcUrls.value);

    if (walletConnectProvider) {
      provider.value = walletConnectProvider;
      connectedWallet.value = WalletType.WalletConnect;
    }
  }

  async function reconnectToWallet(): Promise<void> {
    switch (connectedWallet.value) {
      case WalletType.MetaMask:
        return connectMetaMask();

      case WalletType.WalletConnect:
        return connectWalletConnect();
    }
  }

  return { connectMetaMask, connectWalletConnect, reconnectToWallet };
}
