import { Ref } from 'vue';

import type { EthereumProvider, MetaMaskProvider } from '@/services/web3-provider';
import { createMetaMaskProvider, createWalletConnectProvider } from '@/services/web3-provider';
import { WalletType } from '@/types/settings';

export function useWallet(
  provider: Ref<EthereumProvider | undefined>,
  connectedWallet: Ref<WalletType | undefined>,
  rpcUrls: Ref<{ [chainId: number]: string }>,
) {
  async function getConnectedWalletProvider(): Promise<EthereumProvider | undefined> {
    let connectedProvider = undefined;
    switch (connectedWallet.value) {
      case WalletType.MetaMask:
        connectedProvider = await createMetaMaskProvider();
        break;
      case WalletType.WalletConnect:
        connectedProvider = await createWalletConnectProvider(rpcUrls.value);
        break;
    }
    return connectedProvider;
  }

  async function connectMetaMask() {
    provider.value = await createMetaMaskProvider();

    if (provider.value) {
      (provider.value as MetaMaskProvider).requestSigner();
      connectedWallet.value = WalletType.MetaMask;
    }
  }

  async function connectWalletConnect() {
    provider.value = await createWalletConnectProvider(rpcUrls.value);

    if (provider.value) {
      connectedWallet.value = WalletType.WalletConnect;
    }
  }

  return { getConnectedWalletProvider, connectMetaMask, connectWalletConnect };
}
