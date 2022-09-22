import type { Ref } from 'vue';

import { useAsynchronousTask } from '@/composables/useAsynchronousTask';
import type { EthereumProvider } from '@/services/web3-provider';
import {
  createMetaMaskProvider,
  createWalletConnectProvider,
  onboardMetaMask,
} from '@/services/web3-provider';
import { WalletType } from '@/types/settings';

export function useWallet(
  provider: Ref<EthereumProvider | undefined>,
  connectedWallet: Ref<WalletType | undefined>,
  rpcUrls: Ref<{ [chainId: number]: string }>,
) {
  async function connectMetaMask(withOnboarding?: boolean) {
    const metaMaskProvider = await createMetaMaskProvider();

    if (metaMaskProvider) {
      metaMaskProvider.requestSigner();
      provider.value = metaMaskProvider;
      connectedWallet.value = WalletType.MetaMask;
    } else if (withOnboarding) {
      onboardMetaMask();
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

  async function disconnectWallet() {
    connectedWallet.value = undefined;
    provider.value = undefined;
  }

  const metamaskTask = useAsynchronousTask(connectMetaMask);
  const walletConnectTask = useAsynchronousTask(connectWalletConnect);

  return {
    connectMetaMask: metamaskTask.run,
    connectingMetaMask: metamaskTask.active,
    connectWalletConnect: walletConnectTask.run,
    connectingWalletConnect: walletConnectTask.active,
    reconnectToWallet,
    disconnectWallet,
  };
}
