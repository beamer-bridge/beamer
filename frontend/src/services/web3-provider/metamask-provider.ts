import { ExternalProvider, JsonRpcSigner, Web3Provider } from '@ethersproject/providers';

import { EthereumProvider } from './types';

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
