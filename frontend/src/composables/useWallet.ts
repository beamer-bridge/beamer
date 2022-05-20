import { Ref } from 'vue';

import type { EthereumProvider } from '@/services/web3-provider';
import { createMetaMaskProvider, createWalletConnectProvider } from '@/services/web3-provider';
import { WalletType } from '@/types/settings';

export function useWallet(
  provider: Ref<EthereumProvider | undefined>,
  connectedWallet: Ref<WalletType | undefined>,
  rpcUrls?: { [chainId: number]: string },
  requestSigner?: (provider: EthereumProvider) => void,
) {
  async function getConnectedWalletProvider(): Promise<EthereumProvider | undefined> {
    let connectedProvider = undefined;
    switch (connectedWallet.value) {
      case WalletType.MetaMask:
        connectedProvider = await createMetaMaskProvider();
        break;
      case WalletType.WalletConnect:
        connectedProvider = rpcUrls && (await createWalletConnectProvider(rpcUrls));
        break;
    }
    return connectedProvider;
  }

  async function connectMetaMask() {
    // TODO: In future we will not separate getting provider and signer which
    // resolve the undefined provider case.
    provider.value = await createMetaMaskProvider();
    if (provider.value && requestSigner) {
      requestSigner(provider.value);
      connectedWallet.value = WalletType.MetaMask;
    }
  }

  async function connectWalletConnect() {
    if (rpcUrls) {
      provider.value = await createWalletConnectProvider(rpcUrls);

      if (provider.value) {
        connectedWallet.value = WalletType.WalletConnect;
      }
    }
  }

  return { getConnectedWalletProvider, connectMetaMask, connectWalletConnect };
}
