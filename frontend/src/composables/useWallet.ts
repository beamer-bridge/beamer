import type { Ref } from 'vue';

import { useAsynchronousTask } from '@/composables/useAsynchronousTask';
import type { IEthereumProvider } from '@/services/web3-provider';
import {
  createCoinbaseProvider,
  createMetaMaskProvider,
  createWalletConnectProvider,
  onboardMetaMask,
} from '@/services/web3-provider';
import { WalletType } from '@/types/settings';

export function useWallet(
  provider: Ref<IEthereumProvider | undefined>,
  connectedWallet: Ref<WalletType | undefined>,
  rpcUrls: Ref<{ [chainId: number]: string }>,
) {
  async function connectMetaMask(withOnboarding?: boolean) {
    const metaMaskProvider = await createMetaMaskProvider();

    if (metaMaskProvider) {
      metaMaskProvider.requestSigner();
      provider.value = metaMaskProvider;
      connectedWallet.value = WalletType.MetaMask;
      metaMaskProvider.on('disconnect', disconnectWallet);
    } else if (withOnboarding) {
      onboardMetaMask();
    }
  }

  async function connectWalletConnect() {
    const walletConnectProvider = await createWalletConnectProvider(rpcUrls.value);

    if (walletConnectProvider) {
      provider.value = walletConnectProvider;
      connectedWallet.value = WalletType.WalletConnect;
      walletConnectProvider.on('disconnect', disconnectWallet);
    }
  }

  async function connectCoinbase() {
    const coinbaseProvider = await createCoinbaseProvider(rpcUrls.value);

    if (coinbaseProvider) {
      provider.value = coinbaseProvider;
      connectedWallet.value = WalletType.Coinbase;
      coinbaseProvider.on('disconnect', disconnectWallet);
    }
  }

  async function reconnectToWallet(): Promise<void> {
    switch (connectedWallet.value) {
      case WalletType.MetaMask:
        return connectMetaMask();

      case WalletType.WalletConnect:
        return connectWalletConnect();

      case WalletType.Coinbase:
        return connectCoinbase();
    }
  }

  async function disconnectWallet() {
    connectedWallet.value = undefined;
    provider.value = undefined;
  }

  const metamaskTask = useAsynchronousTask(connectMetaMask);
  const walletConnectTask = useAsynchronousTask(connectWalletConnect);
  const coinbaseTask = useAsynchronousTask(connectCoinbase);

  return {
    connectMetaMask: metamaskTask.run,
    connectingMetaMask: metamaskTask.active,
    connectWalletConnect: walletConnectTask.run,
    connectingWalletConnect: walletConnectTask.active,
    connectCoinbase: coinbaseTask.run,
    connectingCoinbase: coinbaseTask.active,
    reconnectToWallet,
    disconnectWallet,
  };
}
