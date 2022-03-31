import { Block, JsonRpcSigner } from '@ethersproject/providers';
import { Contract } from 'ethers';
import { Ref, ShallowRef } from 'vue';

export interface EthereumProvider {
  signer: ShallowRef<JsonRpcSigner | undefined>;
  signerAddress: ShallowRef<string | undefined>;
  chainId: Ref<number>;
  init(): Promise<void>;
  requestSigner(): Promise<void>;
  getLatestBlock(): Promise<Block>;
  connectContract(contract: Contract): Contract;
  switchChain(newChainId: number): Promise<boolean | null>;
  addChain(chainData: ChainData): Promise<boolean>;
  getChainId(): Promise<number>;
  addToken(tokenData: TokenData): Promise<void>;
}

export type ChainData = {
  chainId: number | string;
  rpcUrl: string;
  name: string;
};

export type TokenData = {
  address: string;
  symbol?: string;
  decimals?: number;
  image?: string;
};
