import {
  Block,
  ExternalProvider,
  getNetwork,
  JsonRpcSigner,
  Web3Provider,
} from '@ethersproject/providers';
import detectEthereumProvider from '@metamask/detect-provider';
import { hexValue } from 'ethers/lib/utils';
import { Ref, ref, ShallowRef, shallowRef } from 'vue';

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
  signer: ShallowRef<JsonRpcSigner | undefined> = shallowRef(undefined);
  chainId: Ref<number> = ref(1);

  private web3Provider: Web3Provider;

  constructor(provider: ExternalProvider) {
    if (!provider.isMetaMask) {
      throw new Error('Given provider is not MetaMask!');
    }
    this.web3Provider = new Web3Provider(provider);
  }

  async init(): Promise<void> {
    this.chainId.value = await this.getChainId();
    await this.tryAccessingDefaultSigner();
    this.listenToEvents();
  }

  async requestSigner(): Promise<void> {
    try {
      await this.web3Provider.send('eth_requestAccounts', []);
      this.signer.value = this.web3Provider.getSigner();
    } catch (error) {
      this.signer.value = undefined;
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

  async getLatestBlock(): Promise<Block> {
    return this.web3Provider.getBlock('latest');
  }

  private async getChainId(): Promise<number> {
    const { chainId } = await this.web3Provider.getNetwork();
    return chainId;
  }

  private async tryAccessingDefaultSigner(): Promise<void> {
    const accounts = await this.web3Provider.listAccounts();
    this.newDefaultSigner(accounts);
  }

  private newDefaultSigner(accounts: string[]): void {
    if (accounts.length === 0) {
      this.signer.value = undefined;
      return;
    }
    this.signer.value = this.web3Provider.getSigner();
  }

  private listenToEvents(): void {
    this.web3Provider.provider.on('accountsChanged', (accounts) =>
      this.newDefaultSigner(accounts),
    );
    this.web3Provider.provider.on('chainChanged', (chainId) => (this.chainId.value = chainId));
  }
}
