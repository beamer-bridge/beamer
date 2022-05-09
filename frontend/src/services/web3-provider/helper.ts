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
    case WalletType.Metamask:
      provider = await createMetaMaskProvider();
      break;
    case WalletType.WalletConnect:
      provider = await createWalletConnectProvider(rpcUrlsList);
      break;
  }

  return provider;
}

export function isSupportedChain(chainId: number): boolean {
  const configuration = useConfiguration();
  return chainId in configuration.chains;
}
