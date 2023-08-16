import { hexValue } from 'ethers/lib/utils';

import { EthereumWallet } from '@/services/web3-provider/ethereum-provider';
import { WalletConnect } from '@/services/web3-provider/util-export';

const BEAMER_PROJECT_ID = import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID || '';

/** A workaround for https://github.com/WalletConnect/walletconnect-monorepo/issues/1144
 *  Remove when fixed.
 */
if (!window.global) {
  window.global = globalThis;
}

export async function createWalletConnectProvider(rpcList: {
  [chainId: string]: string;
}): Promise<WalletConnectProvider | undefined> {
  const chains = Object.keys(rpcList).map((chainId) => parseInt(chainId));

  const provider = await WalletConnect.init({
    chains: [chains[0]],
    optionalChains: chains.slice(1),
    projectId: BEAMER_PROJECT_ID,
    optionalMethods: [
      'wallet_switchEthereumChain',
      'wallet_watchAsset',
      'wallet_addEthereumChain',
    ],
    optionalEvents: ['accountsChanged', 'chainChanged', 'network', 'disconnect'],
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

export class WalletConnectProvider extends EthereumWallet<WalletConnect> {
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
      console.log(error);
      // Once https://github.com/WalletConnect/walletconnect-monorepo/issues/2825 has been resolved,
      // detect an "Unknown  network" exception and return `false in that case.
      // For the other cases, this function should throw the exception.
      return false;
    }
  }
}
