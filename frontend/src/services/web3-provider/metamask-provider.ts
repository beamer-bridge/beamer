import { ExternalProvider } from '@ethersproject/providers';
import detectEthereumProvider from '@metamask/detect-provider';
import { hexValue } from 'ethers/lib/utils';

import { Eip1193Provider, EthereumProvider, ISigner } from '@/services/web3-provider';

export async function createMetaMaskProvider(): Promise<MetaMaskProvider | undefined> {
  const detectedProvider = (await detectEthereumProvider()) as ExternalProvider | undefined;
  if (detectedProvider && detectedProvider.isMetaMask) {
    const metaMaskProvider = new MetaMaskProvider(detectedProvider as Eip1193Provider);
    await metaMaskProvider.init();
    return metaMaskProvider;
  }
  return undefined;
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
      this.signerAddress.value = accounts[0];
    } catch (error) {
      this.signer.value = undefined;
      this.signerAddress.value = undefined;
    }
  }

  async switchChain(newChainId: number): Promise<boolean | null> {
    const unrecognizedChainErrorCode = 4902;
    const newChainIdHex = hexValue(newChainId);
    try {
      await this.web3Provider.send('wallet_switchEthereumChain', [{ chainId: newChainIdHex }]);
      return true;
    } catch (switchError) {
      if ((switchError as { code: number })?.code === unrecognizedChainErrorCode) {
        return null;
      }
      throw switchError;
    }
  }
}
