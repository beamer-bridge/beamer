import { getAddress, hexValue } from 'ethers/lib/utils';

import { EthereumProvider } from '@/services/web3-provider';
import type {
  DetectedEthereumProvider,
  Eip1193Provider,
  ISigner,
} from '@/services/web3-provider/types';
import { detectEthereumProvider, MetaMaskOnboarding } from '@/services/web3-provider/util-export';

export async function createMetaMaskProvider(): Promise<MetaMaskProvider | undefined> {
  const detectedProvider = (await detectEthereumProvider()) as
    | DetectedEthereumProvider
    | undefined;
  let injectedMetamaskProvider;

  if (detectedProvider) {
    // Monkey patch for the BitKeep wallet which uses a buggy window.ethereum API
    // See this for more info: https://github.com/beamer-bridge/beamer/issues/1513
    // May be removed if BitKeep fixes it on their side.
    if (detectedProvider.request) {
      const request = detectedProvider.request;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (detectedProvider.request as (request: any) => Promise<any>) = async (args) => {
        return await request({ ...args, jsonrpc: '2.0' });
      };
    }

    if (detectedProvider.providers) {
      injectedMetamaskProvider = detectedProvider.providers.find(
        (provider) => provider.isMetaMask,
      );
    } else if (detectedProvider.isMetaMask) {
      injectedMetamaskProvider = detectedProvider;
    }
  }

  if (injectedMetamaskProvider) {
    const metaMaskProvider = new MetaMaskProvider(injectedMetamaskProvider as Eip1193Provider);
    await metaMaskProvider.init();
    return metaMaskProvider;
  }

  return undefined;
}

export async function onboardMetaMask() {
  const onboarding = new MetaMaskOnboarding();
  onboarding.startOnboarding();
  return onboarding;
}

export class MetaMaskProvider extends EthereumProvider implements ISigner {
  constructor(_provider: Eip1193Provider) {
    if (!_provider.isMetaMask) {
      throw new Error('Given provider is not MetaMask!');
    }
    super(_provider);
  }

  async requestSigner(): Promise<void> {
    try {
      const accounts: string[] = await this.web3Provider.send('eth_requestAccounts', []);
      this.signer.value = this.web3Provider.getSigner(accounts[0]);
      this.signerAddress.value = getAddress(accounts[0]);
    } catch (error) {
      this.signer.value = undefined;
      this.signerAddress.value = undefined;
    }
  }

  protected async switchChain(newChainId: number): Promise<boolean> {
    const unrecognizedChainErrorCode = 4902;
    const newChainIdHex = hexValue(newChainId);
    try {
      await this.web3Provider.send('wallet_switchEthereumChain', [{ chainId: newChainIdHex }]);
      return true;
    } catch (error) {
      if ((error as { code: number })?.code === unrecognizedChainErrorCode) {
        return false;
      }
      throw error;
    }
  }

  listenToEvents(): void {
    this.listenToChangeEvents();
  }
}
