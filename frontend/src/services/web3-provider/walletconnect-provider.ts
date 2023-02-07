import { hexValue } from 'ethers/lib/utils';

import type { Eip1193Provider } from '@/services/web3-provider';
import { EthereumProvider } from '@/services/web3-provider';
import { WalletConnect } from '@/services/web3-provider/util-export';

const BEAMER_PROJECT_ID = 'b0909ba73ce9e30c4decb50a963c9b2a';

export async function createWalletConnectProvider(rpcList: {
  [chainId: string]: string;
}): Promise<WalletConnectProvider | undefined> {
  const provider = await WalletConnect.init({
    chains: Object.keys(rpcList).map((chainId) => parseInt(chainId)),
    projectId: BEAMER_PROJECT_ID,
    rpcMap: rpcList,
  });

  // Fixes the lack of promise resolution in `provider.enable()` when modal is closed
  const modalClosed = new Promise((resolve) => {
    provider.modal?.subscribeModal(async (newState) => {
      if (!newState.open) {
        resolve(undefined);
      }
    });
  });

  const enabled = provider.enable();

  await Promise.race([modalClosed, enabled]);

  if (provider.connected) {
    const walletConnectProvider = new WalletConnectProvider(provider);
    await walletConnectProvider.init();
    return walletConnectProvider;
  }

  return undefined;
}

export class WalletConnectProvider extends EthereumProvider {
  constructor(_provider: Eip1193Provider) {
    super(_provider);
  }

  protected async switchChain(newChainId: number): Promise<boolean> {
    const newChainIdHex = hexValue(newChainId);
    try {
      await this.web3Provider.send('wallet_switchEthereumChain', [{ chainId: newChainIdHex }]);
      return true;
    } catch (error: unknown) {
      if ((error as Error).message.startsWith('Unrecognized chain ID')) {
        return false;
      }
      throw error;
    }
  }
}
