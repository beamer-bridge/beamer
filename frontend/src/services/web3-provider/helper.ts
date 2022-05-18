import { useRpcUrls } from '@/composables/useRpcUrls';
import { useConfiguration } from '@/stores/configuration';
import { useSettings } from '@/stores/settings';
import { WalletType } from '@/types/settings';

import { createMetaMaskProvider, createWalletConnectProvider } from './';
import { EthereumProvider } from './types';

export async function getConnectedWalletProvider(): Promise<EthereumProvider | undefined> {
  const configuration = useConfiguration();
  const settings = useSettings();
  const rpcUrlsList = useRpcUrls(configuration.chains);
  const connectedWallet = settings.connectedWallet;
  let provider = undefined;

  switch (connectedWallet) {
    case WalletType.MetaMask:
      provider = await createMetaMaskProvider();
      break;
    case WalletType.WalletConnect:
      provider = await createWalletConnectProvider(rpcUrlsList);
      break;
  }

  return provider;
}
