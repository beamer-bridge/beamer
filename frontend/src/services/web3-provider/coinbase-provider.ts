/*
 Depends on 'node-polyfill-webpack-plugin' package for providing the node
 built-in polyfills. 
 Remove the above mentioned package from project once coinbase fixes this:
 https://github.com/coinbase/coinbase-wallet-sdk/issues/56
 */
import type { CoinbaseWalletProvider } from '@coinbase/wallet-sdk';
import { hexValue } from 'ethers/lib/utils';

import { EthereumWallet } from '@/services/web3-provider/ethereum-provider';
import { CoinbaseWalletSDK } from '@/services/web3-provider/util-export';

const APP_NAME = 'Beamer Bridge';
const LOGO_FILENAME = 'logo_padded.png';
const APP_LOGO_URL = `${window.location.origin}/${LOGO_FILENAME}`;

const injectBuffer = async () => {
  const { Buffer } = await import('buffer');
  window.Buffer = Buffer;
};
export async function createCoinbaseProvider(rpcList: {
  [chainId: string]: string;
}): Promise<CoinbaseProvider | undefined> {
  if (!window.Buffer) {
    await injectBuffer();
  }

  const coinbaseWallet = new CoinbaseWalletSDK({
    appName: APP_NAME,
    appLogoUrl: APP_LOGO_URL,
  });

  const chains = Object.keys(rpcList);
  const rpcUrls = Object.values(rpcList);

  /*
    Coinbase uses its own whitelisted RPC URLs internally.
    The only reason why we are providing them here is so users can see
    the mobile wallet selection option.
    See more: https://github.com/coinbase/coinbase-wallet-sdk/issues/800

    TODO: use current selectedSourceChain and provide its rpcUrl here
  */

  const provider = coinbaseWallet.makeWeb3Provider(rpcUrls[0], parseInt(chains[0]));
  await provider.enable();

  if (provider.connected) {
    const coinbaseProvider = new CoinbaseProvider(provider);

    await coinbaseProvider.init();

    return coinbaseProvider;
  }

  return undefined;
}

export class CoinbaseProvider extends EthereumWallet<CoinbaseWalletProvider> {
  constructor(_provider: CoinbaseWalletProvider) {
    super(_provider);
  }

  async closeExternalConnection() {
    await this.externalProvider.close();
    this.externalProvider.disconnect();
  }

  protected async switchChain(newChainId: number): Promise<boolean> {
    const newChainIdHex = hexValue(newChainId);
    try {
      await this.externalProvider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: newChainIdHex }],
      });
      return true;
    } catch (error: unknown) {
      if ((error as Error).message.startsWith('Unrecognized chain ID')) {
        return false;
      }
      throw error;
    }
  }
}
