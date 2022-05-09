import { Block, getNetwork, JsonRpcSigner, Web3Provider } from '@ethersproject/providers';
import WalletConnect from '@walletconnect/web3-provider/dist/umd/index.min.js';
import { BigNumber, Contract } from 'ethers';
import { hexValue } from 'ethers/lib/utils';
import { Ref, ref, ShallowRef, shallowRef } from 'vue';

import { ChainData, Eip1193Provider, EthereumProvider, TokenData } from './types';

export async function createWalletConnectProvider(rpcList: {
  [chainId: string]: string;
}): Promise<WalletConnectProvider | undefined> {
  const provider = new WalletConnect({
    rpc: rpcList,
  });

  await provider.enable();

  if (provider.connected) {
    const walletConnectProvider = new WalletConnectProvider(provider);
    await walletConnectProvider.init();
    return walletConnectProvider;
  }

  return undefined;
}

export class WalletConnectProvider implements EthereumProvider {
  signer: ShallowRef<JsonRpcSigner | undefined> = shallowRef(undefined);
  signerAddress: ShallowRef<string | undefined> = shallowRef(undefined);
  chainId: Ref<number> = ref(1);

  private web3Provider: Web3Provider;
  private externalProvider: Eip1193Provider;

  constructor(_provider: Eip1193Provider) {
    this.web3Provider = new Web3Provider(_provider);
    this.externalProvider = _provider;
  }

  async init(): Promise<void> {
    this.chainId.value = await this.getChainId();
    await this.tryAccessingDefaultSigner();
    this.listenToEvents();
  }

  async switchChain(newChainId: number): Promise<boolean | null> {
    const newChainIdHex = hexValue(newChainId);
    try {
      await this.web3Provider.send('wallet_switchEthereumChain', [{ chainId: newChainIdHex }]);
      return true;
    } catch (switchError: unknown) {
      if ((switchError as Error).message == 'User rejected the request.') throw switchError;
      return null;
    }
  }

  async addChain(chainData: ChainData): Promise<boolean> {
    try {
      const { chainId, name, rpcUrl } = chainData;
      const chainIdHexValue = hexValue(chainId);
      const walletConnectNetworkData = getNetwork(chainId);
      walletConnectNetworkData?.name !== 'unknown' ? walletConnectNetworkData?.name : name;
      const networkData = {
        chainId: chainIdHexValue,
        chainName: name,
        rpcUrls: [rpcUrl],
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
        throw new Error("Couldn't add token to WalletConnect");
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

  private async tryAccessingDefaultSigner(): Promise<void> {
    const accounts = await this.web3Provider.listAccounts();
    this.newDefaultSigner(accounts);
  }

  private newDefaultSigner(accounts: string[]): void {
    if (accounts.length === 0) {
      this.signer.value = undefined;
      this.signerAddress.value = undefined;
      return;
    }
    this.signer.value = this.web3Provider.getSigner(accounts[0]);
    this.signerAddress.value = accounts[0];
  }

  private listenToEvents(): void {
    this.externalProvider.on('accountsChanged', (accounts: string[]) =>
      this.newDefaultSigner(accounts),
    );
    this.externalProvider.on('chainChanged', (chainId: string) => {
      this.chainId.value = BigNumber.from(chainId).toNumber();
    });
  }
}
