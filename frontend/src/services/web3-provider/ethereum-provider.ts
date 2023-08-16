import type { Block, JsonRpcSigner, Network } from '@ethersproject/providers';
import { JsonRpcProvider, Web3Provider } from '@ethersproject/providers';
import { hexValue } from 'ethers/lib/utils';
import EventEmitter from 'events';
import type { Ref, ShallowRef } from 'vue';
import { ref, shallowRef, toRaw } from 'vue';

import type {
  Eip1193Provider,
  IEthereumProvider,
  IEthereumWallet,
} from '@/services/web3-provider/types';
import type { Chain, Token } from '@/types/data';

export async function createEthereumProvider(rpcUrl: string): Promise<IEthereumProvider> {
  const provider = new EthereumProvider(new JsonRpcProvider(rpcUrl));
  await provider.init();
  return provider;
}

export class EthereumProvider<T extends Web3Provider | JsonRpcProvider>
  extends EventEmitter
  implements IEthereumProvider
{
  chainId: Ref<number> = ref(1);

  protected web3Provider: T;

  constructor(_provider: T) {
    super();
    this.web3Provider = _provider;
  }

  async init(): Promise<void> {
    this.chainId.value = await this.getChainId();
  }

  async getLatestBlock(): Promise<Block> {
    return this.web3Provider.getBlock('latest');
  }

  getProvider(): JsonRpcProvider {
    return this.web3Provider;
  }

  async getChainId(): Promise<number> {
    const { chainId } = await this.web3Provider.getNetwork();
    return chainId;
  }

  async waitForTransaction(transactionHash: string, confirmations?: number, timeout?: number) {
    const receipt = await this.web3Provider.waitForTransaction(
      transactionHash,
      confirmations,
      timeout,
    );

    if (receipt.status === 0) {
      throw new Error(`Transaction ${receipt.transactionHash} reverted on chain.`);
    }

    return receipt.transactionHash;
  }
}

export abstract class BasicEthereumWallet<T extends Eip1193Provider>
  extends EthereumProvider<Web3Provider>
  implements IEthereumWallet
{
  signer: ShallowRef<JsonRpcSigner | undefined> = shallowRef(undefined);
  signerAddress: ShallowRef<string | undefined> = shallowRef(undefined);
  disconnectable = true;
  isContractWallet = false;

  protected externalProvider: T;

  constructor(_provider: T) {
    const web3Provider = new Web3Provider(_provider, 'any');
    super(web3Provider);
    this.externalProvider = _provider;
  }

  async init(): Promise<void> {
    await super.init();
    await this.tryAccessingDefaultSigner();
    this.listenToEvents();
  }

  async tryAccessingDefaultSigner(): Promise<void> {
    const accounts = await this.web3Provider.listAccounts();
    if (accounts.length === 0) {
      return this.disconnect();
    }

    this.setSigner(accounts[0]);
  }

  setSigner(account: string): void {
    this.signer.value = this.web3Provider.getSigner(account);
    this.signerAddress.value = account;
  }

  disconnect(): void {
    this.signer.value = undefined;
    this.signerAddress.value = undefined;
    this.emit('disconnect');
  }

  listenToEvents(): void {
    this.listenToChangeEvents();
    this.externalProvider.on('disconnect', () => this.disconnect());
  }

  protected listenToChangeEvents(): void {
    this.externalProvider.on('accountsChanged', () => this.tryAccessingDefaultSigner());
    this.web3Provider.on('network', (newNetwork: Network, oldNetwork: Network) => {
      this.chainId.value = newNetwork.chainId;
      if (oldNetwork) {
        window.location.replace(window.location.pathname);
      }
    });
  }
}

export abstract class EthereumWallet<T extends Eip1193Provider> extends BasicEthereumWallet<T> {
  async switchChainSafely(newChain: Chain): Promise<boolean> {
    let successful = true;
    if (newChain.identifier !== this.chainId.value) {
      try {
        const isSuccessfulSwitch = await this.switchChain(newChain.identifier);
        if (!isSuccessfulSwitch) {
          await this.addChain(newChain);
        }
        // As different wallets handle the add and switch chain methods quite differently
        // (e.g. after an add the switch is not performed automatically),
        // this is the safest way to ensure we are on the correct chain.
        const chainIdAfterRequest = await this.getChainId();
        if (newChain.identifier === chainIdAfterRequest) {
          this.chainId.value = chainIdAfterRequest;
        } else {
          successful = false;
        }
      } catch (error) {
        console.error(error);
        successful = false;
      }
    }
    return successful;
  }

  // Returns false in case the provider does not have the chain.
  // Throws if the user rejects.
  protected abstract switchChain(newChainId: number): Promise<boolean>;

  protected async addChain(chain: Chain): Promise<boolean> {
    try {
      const { identifier: chainId, name, rpcUrl, explorerUrl, nativeCurrency } = chain;

      const chainIdHexValue = hexValue(chainId);
      const networkData = {
        chainId: chainIdHexValue,
        chainName: name,
        rpcUrls: [rpcUrl],
        blockExplorerUrls: [explorerUrl],
        nativeCurrency: nativeCurrency
          ? toRaw(nativeCurrency)
          : {
              name: 'Ether',
              symbol: 'ETH',
              decimals: 18,
            },
      };

      await this.web3Provider.send('wallet_addEthereumChain', [networkData]);
    } catch (error) {
      console.error(error);
      return false;
    }
    return true;
  }

  async addToken(token: Token): Promise<boolean> {
    try {
      const wasAdded = await this.externalProvider.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: token.address,
            symbol: token.symbol,
            decimals: token.decimals,
          },
        },
      });

      return !!wasAdded;
    } catch (error) {
      console.error(error);
      return false;
    }
  }
}
