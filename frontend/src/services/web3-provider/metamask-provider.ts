import {
  Block,
  ExternalProvider,
  getNetwork,
  JsonRpcSigner,
  Web3Provider,
} from '@ethersproject/providers';
import detectEthereumProvider from '@metamask/detect-provider';
import { BigNumber, Contract } from 'ethers';
import { hexValue } from 'ethers/lib/utils';
import { Ref, ref, ShallowRef, shallowRef } from 'vue';

import { ChainData, EthereumProvider, TokenData } from './types';

export async function createMetaMaskProvider(): Promise<MetaMaskProvider | undefined> {
  const detectedProvider = (await detectEthereumProvider()) as ExternalProvider | undefined;
  if (detectedProvider && detectedProvider.isMetaMask) {
    const metaMaskProvider = new MetaMaskProvider(detectedProvider);
    await metaMaskProvider.init();
    return metaMaskProvider;
  }
  return undefined;
}
type OwnExternalProvider = ExternalProvider & {
  on?: (e: string, cb: (param: any) => void) => void;
  request?: (request: { method: string; params: { type: string; options: any } }) => Promise<any>;
};

export class MetaMaskProvider implements EthereumProvider {
  signer: ShallowRef<JsonRpcSigner | undefined> = shallowRef(undefined);
  signerAddress: ShallowRef<string | undefined> = shallowRef(undefined);
  chainId: Ref<number> = ref(1);

  private web3Provider: Web3Provider;
  private provider: OwnExternalProvider;

  constructor(_provider: ExternalProvider) {
    if (!_provider.isMetaMask) {
      throw new Error('Given provider is not MetaMask!');
    }
    this.web3Provider = new Web3Provider(_provider);
    this.provider = this.web3Provider.provider as OwnExternalProvider;
  }

  async init(): Promise<void> {
    this.chainId.value = await this.getChainId();
    await this.tryAccessingDefaultSigner();
    this.listenToEvents();
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
    return false;
  }

  async addChain(chainData: ChainData): Promise<boolean> {
    try {
      const { chainId, name, rpcUrl } = chainData;
      const chainIdHexValue = hexValue(chainId);
      const metaMaskNetworkData = getNetwork(chainId);
      metaMaskNetworkData?.name !== 'unknown' ? metaMaskNetworkData?.name : name;
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
      const wasAdded = this.provider?.request
        ? await this.provider?.request({
            method: 'wallet_watchAsset',
            params: {
              type: 'ERC20',
              options: {
                address: tokenData.address,
                symbol: tokenData.symbol,
                decimals: tokenData.decimals || 18,
              },
            },
          })
        : false;
      if (!wasAdded) {
        throw new Error("Couldn't add token to metamask");
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
    this.provider.on &&
      this.provider.on('accountsChanged', (accounts: string[]) =>
        this.newDefaultSigner(accounts),
      ) &&
      this.provider.on('chainChanged', (chainId: string) => {
        this.chainId.value = BigNumber.from(chainId).toNumber();
      });
  }
}
