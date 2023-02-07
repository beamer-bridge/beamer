import type { ExternalProvider } from '@ethersproject/providers';
import { getAddress, hexValue } from 'ethers/lib/utils';

import { EthereumProvider } from '@/services/web3-provider';
import type { Eip1193Provider, ISigner } from '@/services/web3-provider/types';
import { detectEthereumProvider, MetaMaskOnboarding } from '@/services/web3-provider/util-export';

export async function createMetaMaskProvider(): Promise<MetaMaskProvider | undefined> {
  const detectedProvider = (await detectEthereumProvider({ mustBeMetaMask: true })) as
    | ExternalProvider
    | undefined;

  if (detectedProvider && detectedProvider.isMetaMask) {
    const metaMaskProvider = new MetaMaskProvider(detectedProvider as Eip1193Provider);
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
