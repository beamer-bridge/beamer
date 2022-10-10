import type { Block, JsonRpcSigner } from '@ethersproject/providers';
import { getNetwork, Web3Provider } from '@ethersproject/providers';
import type { Contract } from 'ethers';
import { BigNumber } from 'ethers';
import { hexValue } from 'ethers/lib/utils';
import EventEmitter from 'events';
import type { Ref, ShallowRef } from 'vue';
import { ref, shallowRef } from 'vue';

import type { Chain } from '@/types/data';

import type { ChainData, Eip1193Provider, IEthereumProvider, TokenData } from './types';

export abstract class EthereumProvider extends EventEmitter implements IEthereumProvider {
  signer: ShallowRef<JsonRpcSigner | undefined> = shallowRef(undefined);
  signerAddress: ShallowRef<string | undefined> = shallowRef(undefined);
  chainId: Ref<number> = ref(1);

  protected web3Provider: Web3Provider;
  protected externalProvider: Eip1193Provider;

  constructor(_provider: Eip1193Provider) {
    super();
    this.web3Provider = new Web3Provider(_provider);
    this.externalProvider = _provider;
  }

  async init(): Promise<void> {
    this.chainId.value = await this.getChainId();
    await this.tryAccessingDefaultSigner();
    this.listenToEvents();
  }

  async switchChainSafely(newChain: Chain): Promise<boolean> {
    if (newChain.identifier !== this.chainId.value) {
      try {
        const isSuccessfulSwitch = await this.switchChain(newChain.identifier);
        if (!isSuccessfulSwitch) {
          await this.addChain({
            chainId: newChain.identifier,
            name: newChain.name,
            rpcUrl: newChain.rpcUrl,
          });
        }
        // As different wallets handle the add and switch chain methods quite differently
        // (e.g. after an add the switch is not performed automatically),
        // this is the safest way to ensure we are on the correct chain.
        if (newChain.identifier !== this.chainId.value) {
          return false;
        }
      } catch (error) {
        console.error(error);
        return false;
      }
    }
    return true;
  }

  // Returns false in case the provider does not have the chain.
  // Throws if the user rejects.
  protected abstract switchChain(newChainId: number): Promise<boolean>;

  protected async addChain(chainData: ChainData): Promise<boolean> {
    try {
      const { chainId, name, rpcUrl } = chainData;
      const chainIdHexValue = hexValue(chainId);
      const providerNetworkData = getNetwork(chainId);
      providerNetworkData?.name !== 'unknown' ? providerNetworkData?.name : name;
      const networkData = {
        chainId: chainIdHexValue,
        chainName: name,
        rpcUrls: [rpcUrl],
        nativeCurrency: {
          name: 'Ethereum',
          symbol: 'ETH',
          decimals: 18,
        },
      };
      await this.web3Provider.send('wallet_addEthereumChain', [networkData]);
    } catch (error) {
      return false;
    }
    return true;
  }

  async addToken(tokenData: TokenData): Promise<void> {
    try {
      const wasAdded = await this.externalProvider.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: tokenData.address,
            symbol: tokenData.symbol,
            decimals: tokenData.decimals,
          },
        },
      });
      if (!wasAdded) {
        throw new Error("Couldn't add token to MetaMask");
      }
    } catch (error) {
      console.log(error);
    }
  }

  async getLatestBlock(): Promise<Block> {
    return this.web3Provider.getBlock('latest');
  }

  connectContract(contract: Contract): Contract {
    return contract.connect(this.web3Provider);
  }

  async getChainId(): Promise<number> {
    const { chainId } = await this.web3Provider.getNetwork();
    return chainId;
  }

  async tryAccessingDefaultSigner(): Promise<void> {
    const accounts = await this.web3Provider.listAccounts();
    this.newDefaultSigner(accounts);
  }

  newDefaultSigner(accounts: string[]): void {
    if (accounts.length === 0) {
      return this.disconnect();
    }
    this.signer.value = this.web3Provider.getSigner(accounts[0]);
    this.signerAddress.value = accounts[0];
  }

  disconnect(): void {
    this.signer.value = undefined;
    this.signerAddress.value = undefined;
    this.emit('disconnect');
  }

  listenToEvents(): void {
    this.externalProvider.on('accountsChanged', (accounts: string[]) =>
      this.newDefaultSigner(accounts),
    );
    this.externalProvider.on('chainChanged', (chainId: string) => {
      this.chainId.value = BigNumber.from(chainId).toNumber();
    });
    this.externalProvider.on('disconnect', () => this.disconnect());
  }
}
