import type { Block, ExternalProvider, JsonRpcSigner } from '@ethersproject/providers';
import type { Contract } from 'ethers';
import type { Ref, ShallowRef } from 'vue';

import type { Chain } from '@/types/data';

export interface IEthereumProvider {
  signer: ShallowRef<JsonRpcSigner | undefined>;
  signerAddress: ShallowRef<string | undefined>;
  chainId: Ref<number>;
  init(): Promise<void>;
  getLatestBlock(): Promise<Block>;
  connectContract(contract: Contract): Contract;
  switchChainSafely(newChain: Chain): Promise<boolean>;
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
