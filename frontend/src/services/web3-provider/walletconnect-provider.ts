import { hexValue } from 'ethers/lib/utils';

import { EthereumProvider } from '@/services/web3-provider/ethereum-provider';
import { WalletConnect } from '@/services/web3-provider/util-export';

const BEAMER_PROJECT_ID = 'b0909ba73ce9e30c4decb50a963c9b2a';

export async function createWalletConnectProvider(rpcList: {
  [chainId: string]: string;
}): Promise<WalletConnectProvider | undefined> {
  const chains = Object.keys(rpcList).map((chainId) => parseInt(chainId));

  const provider = await WalletConnect.init({
    chains,
    projectId: BEAMER_PROJECT_ID,
    rpcMap: rpcList,
    showQrModal: true,
  });

  try {
    await provider.enable();
  } catch (e) {
    console.log('exception', e);
  }

  if (provider.connected) {
    const walletConnectProvider = new WalletConnectProvider(provider);
    await walletConnectProvider.init();
    return walletConnectProvider;
  }

  return undefined;
}

export class WalletConnectProvider extends EthereumProvider<WalletConnect> {
  constructor(_provider: WalletConnect) {
    super(_provider);
  }

  async closeExternalConnection() {
    await this.externalProvider.disconnect();
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
