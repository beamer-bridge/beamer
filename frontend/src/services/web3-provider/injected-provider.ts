import type { ExternalProvider } from '@ethersproject/providers';
import { getAddress, hexValue } from 'ethers/lib/utils';

import { EthereumWallet } from '@/services/web3-provider/ethereum-provider';
import type { Eip1193Provider } from '@/services/web3-provider/types';
import { detectEthereumProvider } from '@/services/web3-provider/util-export';

export async function createInjectedProvider(): Promise<InjectedProvider | undefined> {
  const detectedProvider = (await detectEthereumProvider()) as ExternalProvider | undefined;

  if (detectedProvider && !detectedProvider.isMetaMask) {
    const injectedProvider = new InjectedProvider(detectedProvider as Eip1193Provider);
    await injectedProvider.init();
    return injectedProvider;
  }

  return undefined;
}

export class InjectedProvider extends EthereumWallet<Eip1193Provider> {
  constructor(_provider: Eip1193Provider) {
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
    const newChainIdHex = hexValue(newChainId);
    try {
      await this.web3Provider.send('wallet_switchEthereumChain', [{ chainId: newChainIdHex }]);
      return true;
    } catch (error) {
      return false;
    }
  }
}
