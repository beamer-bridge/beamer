import {
  ExternalProvider,
  getNetwork,
  JsonRpcSigner,
  Web3Provider,
} from '@ethersproject/providers';
import detectEthereumProvider from '@metamask/detect-provider';
import { hexValue } from 'ethers/lib/utils';

import { EthereumProvider } from './types';

export async function createMetaMaskProvider(): Promise<MetaMaskProvider | undefined> {
  const detectedProvider = (await detectEthereumProvider()) as ExternalProvider | undefined;
  if (detectedProvider && detectedProvider.isMetaMask) {
    const metaMaskProvider = new MetaMaskProvider(detectedProvider);
    await metaMaskProvider.init();
    return metaMaskProvider;
  }
  return undefined;
}

export class MetaMaskProvider implements EthereumProvider {
  signer: JsonRpcSigner | undefined;

  private web3Provider: Web3Provider;

  constructor(provider: ExternalProvider) {
    if (!provider.isMetaMask) {
      throw new Error('Given provider is not MetaMask!');
    }
    this.web3Provider = new Web3Provider(provider);
  }

  async init(): Promise<void> {
    await this.tryAccessingDefaultSigner();
    this.listenToEvents();
  }

  async getChainId(): Promise<number> {
    const { chainId } = await this.web3Provider.getNetwork();
    return chainId;
  }

  async requestSigner(): Promise<void> {
    try {
      await this.web3Provider.send('eth_requestAccounts', []);
      this.signer = this.web3Provider.getSigner();
    } catch (error) {
      this.signer = undefined;
    }
  }

  async switchChain(newChainId: number, rpcUrl?: string): Promise<void> {
    const newChainIdHex = hexValue(newChainId);
    try {
      await this.web3Provider.send('wallet_switchEthereumChain', [{ chainId: newChainIdHex }]);
    } catch (switchError) {
      // This error code indicates that the chain has not been added to MetaMask.
      // TODO add proper typing for error
      if (rpcUrl && (switchError as { code?: number })?.code === 4902) {
        try {
          const { name } = getNetwork(newChainId);
          await this.web3Provider.send('wallet_addEthereumChain', [
            { chainId: newChainIdHex, chainName: name, rpcUrls: [rpcUrl] },
          ]);
          // eslint-disable-next-line no-empty
        } catch {}
      }
    }
  }

  private async tryAccessingDefaultSigner(): Promise<void> {
    const accounts = await this.web3Provider.listAccounts();
    this.newDefaultSigner(accounts);
  }

  private newDefaultSigner(accounts: string[]): void {
    if (accounts.length === 0) {
      this.signer = undefined;
      return;
    }
    this.signer = this.web3Provider.getSigner();
  }

  private listenToEvents(): void {
    this.web3Provider.on('accountsChanged', (accounts) => this.newDefaultSigner(accounts));
  }
}
