import { Block, ExternalProvider, JsonRpcSigner } from '@ethersproject/providers';
import { Contract } from 'ethers';
import { Ref, ShallowRef } from 'vue';

export interface IEthereumProvider {
  signer: ShallowRef<JsonRpcSigner | undefined>;
  signerAddress: ShallowRef<string | undefined>;
  chainId: Ref<number>;
  init(): Promise<void>;
  getLatestBlock(): Promise<Block>;
  connectContract(contract: Contract): Contract;
  switchChain(newChainId: number): Promise<boolean | null>;
  addChain(chainData: ChainData): Promise<boolean>;
  getChainId(): Promise<number>;
  addToken(tokenData: TokenData): Promise<void>;
}

export interface ISigner {
  requestSigner(): Promise<void>;
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

interface RequestArguments {
  readonly method: string;
  readonly params?: readonly unknown[] | object;
}

export type Eip1193Provider = ExternalProvider & {
  request(args: RequestArguments): Promise<unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(eventName: string, listener: (...args: any[]) => void): void;
};
