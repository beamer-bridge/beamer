import type { Block, JsonRpcSigner, Web3Provider } from '@ethersproject/providers';
import type { Ref, ShallowRef } from 'vue';

import type { Chain, Token, TransactionHash } from '@/types/data';

export interface IEthereumProvider {
  signer: ShallowRef<JsonRpcSigner | undefined>;
  signerAddress: ShallowRef<string | undefined>;
  chainId: Ref<number>;
  init(): Promise<void>;
  getLatestBlock(): Promise<Block>;
  getProvider(): Web3Provider;
  switchChainSafely?(newChain: Chain): Promise<boolean>;
  getChainId(): Promise<number>;
  addToken?(token: Token): Promise<boolean>;
  getActualTransactionHash?(internalTransactionHash: string): Promise<string>;
  waitForTransaction(
    transactionHash: TransactionHash,
    confirmations?: number,
    timeout?: number,
  ): Promise<TransactionHash>;
  disconnectable: boolean;
  isContractWallet: boolean;
  disconnect(): Promise<void>;
  closeExternalConnection(): Promise<void>;
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

export interface DisconnectableProvider {
  disconnect(): Promise<void>;
}

export type ExternalProvider = Eip1193Provider & {
  isMetaMask?: boolean;
  sendAsync?: (
    request: RequestArguments,
    callback: (error: unknown, response: unknown) => void,
  ) => void;
  send?: (
    request: RequestArguments,
    callback: (error: unknown, response: unknown) => void,
  ) => void;
  request?: (request: RequestArguments) => Promise<unknown>;
};

export type Eip1193Provider = {
  request(args: RequestArguments): Promise<unknown>;
  on(eventName: string, listener: (...args: unknown[]) => void): void;
};

export type DetectedEthereumProvider =
  | ExternalProvider & {
      providers?: Array<ExternalProvider>;
    };
