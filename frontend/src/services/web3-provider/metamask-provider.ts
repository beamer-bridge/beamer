import { hexValue } from 'ethers/lib/utils';

import { InjectedProvider } from '@/services/web3-provider/injected-provider';
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
    if (detectedProvider.providers) {
      injectedMetamaskProvider = detectedProvider.providers.find(
        (provider) => provider.isMetaMask,
      );
    } else if (detectedProvider.isMetaMask) {
      injectedMetamaskProvider = detectedProvider;
    } else {
      throw new Error('Cannot connect to MetaMask while other wallet extensions are active.');
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

export class MetaMaskProvider extends InjectedProvider implements ISigner {
  constructor(_provider: Eip1193Provider) {
    if (!_provider.isMetaMask) {
      throw new Error('Given provider is not MetaMask!');
    }
    super(_provider);
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
