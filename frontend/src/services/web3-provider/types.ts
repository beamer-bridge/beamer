import type {
  Block,
  ExternalProvider,
  JsonRpcSigner,
  Web3Provider,
} from '@ethersproject/providers';
import type { Contract } from 'ethers';
import type { Ref, ShallowRef } from 'vue';

import type { Chain, Token } from '@/types/data';

export interface IEthereumProvider {
  signer: ShallowRef<JsonRpcSigner | undefined>;
  signerAddress: ShallowRef<string | undefined>;
  chainId: Ref<number>;
  init(): Promise<void>;
  getLatestBlock(): Promise<Block>;
  getProvider(): Web3Provider;
  connectContract(contract: Contract): Contract;
  switchChainSafely(newChain: Chain): Promise<boolean>;
  getChainId(): Promise<number>;
  addToken(token: Token): Promise<void>;
}
export interface EventEmitter {
  on(eventName: string, listener: (...args: unknown[]) => void): void;
  emit(eventName: string): void;
}
export interface ISigner {
  requestSigner(): Promise<void>;
}

interface RequestArguments {
  readonly method: string;
  readonly params?: readonly unknown[] | object;
}

export type Eip1193Provider = ExternalProvider & {
  request(args: RequestArguments): Promise<unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(eventName: string, listener: (...args: any[]) => void): void;
};
